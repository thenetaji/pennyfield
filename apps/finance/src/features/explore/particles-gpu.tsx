import * as React from "react";
import { Canvas, useCanvasRef } from "react-native-webgpu";

import { type ParticleLayouts } from "@/lib/explore/particles";

const SHADER = /* wgsl */ `
struct Globals { size: vec2f, progress: f32, time: f32 };
@group(0) @binding(0) var<uniform> globals: Globals;

struct Particle {
  @location(0) time_pos: vec2f,
  @location(1) group_pos: vec2f,
  @location(2) scale: f32,
  @location(3) color: vec3f,
};

struct Out {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) color: vec3f,
};

const QUAD = array<vec2f, 6>(
  vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
  vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1),
);

@vertex
fn vs(p: Particle, @builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Out {
  let stagger = f32(i % 40u) * 0.0125;
  let eased = clamp(globals.progress * 1.5 - stagger, 0.0, 1.0);
  let drift = globals.time * 0.7 + f32(i);
  let at = mix(p.time_pos, p.group_pos, eased) + vec2f(sin(drift), cos(drift * 0.8)) * 1.6;
  let corner = QUAD[v];
  let pixel = at + corner * p.scale * 34.0;
  var out: Out;
  out.position = vec4f(pixel.x / globals.size.x * 2.0 - 1.0, 1.0 - pixel.y / globals.size.y * 2.0, 0.0, 1.0);
  out.local = corner;
  out.color = p.color;
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4f {
  let fall = max(0.0, 1.0 - length(in.local));
  let glow = fall * fall;
  return vec4f(in.color * glow, glow);
}
`;

const FLOATS_PER_PARTICLE = 8;

function parseColor(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** The same particles as the Skia view, drawn by the GPU with additive glow. Calls `onFail` where WebGPU can't run. */
export default function GpuParticleField({
  layouts,
  colors,
  progress,
  width,
  height,
  onFail,
}: {
  layouts: ParticleLayouts;
  colors: string[];
  /** Read every frame: 0 is by time, 1 is by category. */
  progress: () => number;
  width: number;
  height: number;
  onFail: () => void;
}) {
  const ref = useCanvasRef();
  const start = async () => {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("no adapter");
      const device = await adapter.requestDevice();
      const context = ref.current?.getContext("webgpu");
      if (!context) throw new Error("no context");
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: "premultiplied" });

      const count = layouts.scale.length;
      const data = new Float32Array(count * FLOATS_PER_PARTICLE);
      for (let i = 0; i < count; i += 1) {
        const [r, g, b] = parseColor(colors[i] ?? "#FFFFFF");
        data.set(
          [layouts.timeX[i]!, layouts.timeY[i]!, layouts.groupX[i]!, layouts.groupY[i]!, layouts.scale[i]!, r, g, b],
          i * FLOATS_PER_PARTICLE,
        );
      }
      const particles = device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(particles, 0, data);
      const globals = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const module = device.createShaderModule({ code: SHADER });
      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module,
          entryPoint: "vs",
          buffers: [
            {
              arrayStride: FLOATS_PER_PARTICLE * 4,
              stepMode: "instance",
              attributes: [
                { shaderLocation: 0, offset: 0, format: "float32x2" },
                { shaderLocation: 1, offset: 8, format: "float32x2" },
                { shaderLocation: 2, offset: 16, format: "float32" },
                { shaderLocation: 3, offset: 20, format: "float32x3" },
              ],
            },
          ],
        },
        fragment: {
          module,
          entryPoint: "fs",
          targets: [
            {
              format,
              blend: {
                color: { srcFactor: "one", dstFactor: "one", operation: "add" },
                alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
              },
            },
          ],
        },
        primitive: { topology: "triangle-list" },
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: globals } }],
      });
      const started = Date.now();
      let frame = 0;
      const draw = () => {
        device.queue.writeBuffer(
          globals,
          0,
          new Float32Array([width, height, progress(), (Date.now() - started) / 1000]),
        );
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: [0, 0, 0, 0],
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, particles);
        pass.draw(6, count);
        pass.end();
        device.queue.submit([encoder.finish()]);
        context.present();
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(frame);
    } catch {
      onFail();
      return undefined;
    }
  };
  React.useEffect(() => {
    const running = start();
    return () => {
      void running.then((stop) => stop?.());
    };
    // Rebuilding the GPU pipeline only makes sense for new particles or a new size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts, width, height]);
  return <Canvas ref={ref} style={{ width, height }} />;
}

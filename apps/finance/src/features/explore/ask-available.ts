import * as React from "react";

import { aiStatus, type AiStatus } from "../../../modules/finance-ai";

export function useAskAvailable(): boolean {
  const [status, setStatus] = React.useState<AiStatus>("unavailable");
  React.useEffect(() => {
    let live = true;
    void aiStatus().then((next) => {
      if (live) setStatus(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return status === "ready";
}

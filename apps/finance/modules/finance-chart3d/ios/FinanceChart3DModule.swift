import Charts
import ExpoModulesCore
import SwiftUI

public class FinanceChart3DModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FinanceChart3D")

    Function("available") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    View(FinanceChart3DView.self) {
      Prop("points") { (view: FinanceChart3DView, rows: [[Double]]) in
        view.rows = rows
        view.render()
      }
      Prop("tint") { (view: FinanceChart3DView, tint: UIColor) in
        view.tint = tint
        view.render()
      }
    }
  }
}

final class FinanceChart3DView: ExpoView {
  var rows: [[Double]] = []
  var tint: UIColor = .systemBlue
  private var host: UIViewController?

  func render() {
    guard #available(iOS 26.0, *) else { return }
    host?.view.removeFromSuperview()
    let points = rows.enumerated().compactMap { index, row -> SpendPoint? in
      row.count == 3 ? SpendPoint(id: index, week: row[0], weekday: row[1], amount: row[2]) : nil
    }
    let controller = UIHostingController(rootView: SpendChart3D(points: points, tint: Color(tint)))
    controller.view.backgroundColor = .clear
    controller.view.frame = bounds
    controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(controller.view)
    host = controller
  }
}

struct SpendPoint: Identifiable {
  let id: Int
  let week: Double
  let weekday: Double
  let amount: Double
}

@available(iOS 26.0, *)
struct SpendChart3D: View {
  let points: [SpendPoint]
  let tint: Color
  @State private var pose: Chart3DPose = .default

  var body: some View {
    Chart3D(points) { point in
      PointMark(
        x: .value("Week", point.week),
        y: .value("Spent", point.amount),
        z: .value("Weekday", point.weekday)
      )
      .foregroundStyle(tint)
    }
    .chartXAxisLabel("Week")
    .chartYAxisLabel("Spent")
    .chartZAxisLabel("Weekday")
    .chart3DPose($pose)
  }
}

import AVFoundation
import ExpoModulesCore

public final class RezetCameraHrvModule: Module {
  private var controller: RezetCameraHrvController?

  public func definition() -> ModuleDefinition {
    Name("RezetCameraHrv")

    Events("hrvStatus")

    View(RezetCameraHrvPreviewView.self) {}

    AsyncFunction("isAvailable") { () -> Bool in
      AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) != nil
    }

    AsyncFunction("getPermissionStatus") { () -> String in
      Self.stringFromPermissionStatus(AVCaptureDevice.authorizationStatus(for: .video))
    }

    AsyncFunction("requestPermission") { () async -> String in
      let currentStatus = AVCaptureDevice.authorizationStatus(for: .video)
      if currentStatus != .notDetermined {
        return Self.stringFromPermissionStatus(currentStatus)
      }

      let granted = await withCheckedContinuation { continuation in
        AVCaptureDevice.requestAccess(for: .video) { didGrantAccess in
          continuation.resume(returning: didGrantAccess)
        }
      }

      if granted {
        return "granted"
      }

      return Self.stringFromPermissionStatus(AVCaptureDevice.authorizationStatus(for: .video))
    }

    AsyncFunction("start") { (torchPreferred: Bool?, updateIntervalMs: Int?) throws in
      guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
        self.emitStatus([
          "state": "unavailable",
          "signalQuality": "low",
          "fingerDetected": false,
        ])
        return
      }

      let controller = self.getController()
      try controller.start(
        torchPreferred: torchPreferred ?? true,
        updateIntervalMs: updateIntervalMs ?? 1000
      )

      self.emitStatus([
        "state": "finding_signal",
        "signalQuality": "low",
        "fingerDetected": false,
      ])
    }

    AsyncFunction("resetMeasurementWindow") {
      self.getController().resetMeasurementWindow()
    }

    AsyncFunction("finishMeasurement") { () -> [String: Any]? in
      self.getController().finishMeasurement()?.asDictionary()
    }

    AsyncFunction("stop") {
      self.controller?.stop()
      self.sendOffState()
    }

    OnAppEntersBackground {
      self.controller?.stop()
      self.sendOffState()
    }
  }

  private func getController() -> RezetCameraHrvController {
    if let controller {
      return controller
    }

    let controller = RezetCameraHrvRuntime.shared.controller
    RezetCameraHrvRuntime.shared.eventSink = { [weak self] (snapshot: RezetCameraHrvSnapshot) in
      self?.emitStatus([
        "state": snapshot.state,
        "heartRateBpm": snapshot.heartRateBpm,
        "hrvRmssdMs": snapshot.hrvRmssdMs,
        "signalQuality": snapshot.signalQuality,
        "fingerDetected": snapshot.fingerDetected,
      ])
    }

    self.controller = controller
    return controller
  }

  private func sendOffState() {
    emitStatus([
      "state": "off",
      "signalQuality": "low",
      "fingerDetected": false,
    ])
  }

  private func emitStatus(_ payload: [String: Any?]) {
    DispatchQueue.main.async {
      self.sendEvent("hrvStatus", payload)
    }
  }

  private static func stringFromPermissionStatus(_ status: AVAuthorizationStatus) -> String {
    switch status {
    case .authorized:
      return "granted"
    case .denied:
      return "denied"
    case .restricted:
      return "restricted"
    case .notDetermined:
      return "undetermined"
    @unknown default:
      return "restricted"
    }
  }
}

final class RezetCameraHrvRuntime {
  static let shared = RezetCameraHrvRuntime()

  let controller = RezetCameraHrvController()

  var eventSink: ((RezetCameraHrvSnapshot) -> Void)? {
    didSet {
      controller.eventSink = eventSink
    }
  }

  private init() {}
}

final class RezetCameraHrvPreviewView: ExpoView {
  private let previewLayer = AVCaptureVideoPreviewLayer(
    session: RezetCameraHrvRuntime.shared.controller.captureSession
  )

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black

    previewLayer.videoGravity = .resizeAspectFill
    if let connection = previewLayer.connection,
       connection.isVideoOrientationSupported {
      connection.videoOrientation = .portrait
    }

    layer.addSublayer(previewLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
  }
}

import UIKit
import Capacitor
import AVFAudio
import MediaPlayer
import UniformTypeIdentifiers

class LectorViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LectorDevicePlugin())
        bridge?.registerPluginInstance(LectorSpeechPlugin())
    }
}

enum LectorBookInbox {
    static var pending: URL?
    static func receive(_ url: URL) {
        guard url.isFileURL else { return }
        pending = url
        NotificationCenter.default.post(name: Notification.Name("LectorOpenBook"), object: url)
    }
}

@objc(LectorDevicePlugin)
class LectorDevicePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "LectorDevicePlugin"
    let jsName = "LectorDevice"
    let pluginMethods: [CAPPluginMethod] = ["info", "initialBook", "releaseBook", "chooseFolder", "permission", "listDirectory", "readFile", "saveFile", "printHTML"].compactMap { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var scopes: [String: URL] = [:]
    private var pickerCall: CAPPluginCall?
    private var pickerPurpose = ""
    private var exportDirectory: URL?
    private let rootKey = "LectorFolderBookmarks"
    override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(openBook(_:)), name: Notification.Name("LectorOpenBook"), object: nil)
    }
    private func book(_ url: URL) throws -> [String: Any] {
        let token = UUID().uuidString
        _ = url.startAccessingSecurityScopedResource()
        scopes[token] = url
        let values = try url.resourceValues(forKeys: [.fileSizeKey])
        return ["uri": url.absoluteString, "name": url.lastPathComponent, "size": values.fileSize ?? 0, "token": token]
    }
    @objc private func openBook(_ note: Notification) {
        guard let url = note.object as? URL, let data = try? book(url) else { return }
        LectorBookInbox.pending = nil
        notifyListeners("openBook", data: data, retainUntilConsumed: true)
    }
    @objc func info(_ call: CAPPluginCall) { call.resolve(["tv": false, "printing": UIPrintInteractionController.isPrintingAvailable]) }
    @objc func initialBook(_ call: CAPPluginCall) {
        guard let url = LectorBookInbox.pending else { call.resolve(); return }
        LectorBookInbox.pending = nil
        do { call.resolve(try book(url)) } catch { call.reject("No se pudo abrir el archivo seleccionado.") }
    }
    @objc func releaseBook(_ call: CAPPluginCall) {
        if let token = call.getString("token"), let url = scopes.removeValue(forKey: token) { url.stopAccessingSecurityScopedResource() }
        call.resolve()
    }
    @objc func chooseFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pickerCall == nil else { call.reject("Ya hay un selector abierto."); return }
            self.pickerCall = call; self.pickerPurpose = "folder"
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }
    private func root(_ call: CAPPluginCall) throws -> URL {
        let records = UserDefaults.standard.dictionary(forKey: rootKey) as? [String: Data] ?? [:]
        guard let id = call.getString("rootId"), let bookmark = records[id] else { throw NSError(domain: "Lector", code: 1) }
        var stale = false
        return try URL(resolvingBookmarkData: bookmark, options: [.withoutUI], relativeTo: nil, bookmarkDataIsStale: &stale)
    }
    private func target(_ call: CAPPluginCall, base: URL) throws -> URL {
        var url = base
        for part in call.getArray("parts", String.self) ?? [] {
            guard !part.isEmpty, part != ".", part != "..", !part.contains("/"), !part.contains("\\"), !part.contains("\0") else { throw NSError(domain: "Lector", code: 2) }
            url.appendPathComponent(part)
        }
        let canonical = url.resolvingSymlinksInPath().standardizedFileURL.path
        let rootPath = base.resolvingSymlinksInPath().standardizedFileURL.path
        guard canonical == rootPath || canonical.hasPrefix(rootPath + "/") else { throw NSError(domain: "Lector", code: 3) }
        return url
    }
    @objc func permission(_ call: CAPPluginCall) {
        do { let url = try root(call); let allowed = url.startAccessingSecurityScopedResource(); if allowed { url.stopAccessingSecurityScopedResource() }; call.resolve(["state": allowed ? "granted" : "prompt"]) } catch { call.resolve(["state": "prompt"]) }
    }
    @objc func listDirectory(_ call: CAPPluginCall) {
        do {
            let base = try root(call); _ = base.startAccessingSecurityScopedResource(); defer { base.stopAccessingSecurityScopedResource() }
            let url = try target(call, base: base)
            let entries = try FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey], options: [.skipsHiddenFiles]).compactMap { item -> [String: Any]? in
                guard let values = try? item.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]), values.isSymbolicLink != true else { return nil }
                return ["name": item.lastPathComponent, "kind": values.isDirectory == true ? "directory" : "file"]
            }
            call.resolve(["entries": entries])
        } catch { call.reject("No se pudo enumerar la carpeta. Vuelve a elegirla.") }
    }
    @objc func readFile(_ call: CAPPluginCall) {
        do {
            let base = try root(call); _ = base.startAccessingSecurityScopedResource()
            let url = try target(call, base: base), token = UUID().uuidString
            scopes[token] = base
            let values = try url.resourceValues(forKeys: [.fileSizeKey])
            call.resolve(["uri": url.absoluteString, "name": url.lastPathComponent, "size": values.fileSize ?? 0, "token": token])
        } catch { call.reject("No se pudo abrir el archivo de la carpeta.") }
    }
    @objc func saveFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pickerCall == nil else { call.reject("Ya hay un selector abierto."); return }
            guard let encoded = call.getString("base64"), encoded.count <= 140 * 1024 * 1024, let data = Data(base64Encoded: encoded) else { call.reject("El archivo supera 100 MB."); return }
            do {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let suggested = call.getString("name") ?? "Lector", name = URL(fileURLWithPath: suggested).lastPathComponent
                let url = directory.appendingPathComponent(name)
                try data.write(to: url)
                self.exportDirectory = directory; self.pickerCall = call; self.pickerPurpose = "export"
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                picker.delegate = self; self.bridge?.viewController?.present(picker, animated: true)
            } catch { call.reject("No se pudo preparar el archivo.") }
        }
    }
    private func finishExport() {
        if let directory = exportDirectory, directory.deletingLastPathComponent().standardizedFileURL == FileManager.default.temporaryDirectory.standardizedFileURL { try? FileManager.default.removeItem(at: directory) }
        exportDirectory = nil; pickerCall = nil; pickerPurpose = ""
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { pickerCall?.resolve(["cancelled": true]); finishExport() }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickerCall, let url = urls.first else { return }
        if pickerPurpose == "folder" {
            do {
                _ = url.startAccessingSecurityScopedResource(); defer { url.stopAccessingSecurityScopedResource() }
                let bookmark = try url.bookmarkData(options: [.minimalBookmark], includingResourceValuesForKeys: nil, relativeTo: nil)
                let id = call.getString("rootId") ?? UUID().uuidString
                var records = UserDefaults.standard.dictionary(forKey: rootKey) as? [String: Data] ?? [:]; records[id] = bookmark; UserDefaults.standard.set(records, forKey: rootKey)
                call.resolve(["rootId": id, "name": url.lastPathComponent, "parts": [], "kind": "directory", "nativeLectorHandle": true])
            } catch { call.reject("No se pudo acceder a la carpeta elegida.") }
        } else { call.resolve() }
        finishExport()
    }
    @objc func printHTML(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let printer = UIPrintInteractionController.shared
            printer.printFormatter = UIMarkupTextPrintFormatter(markupText: call.getString("html") ?? "")
            printer.present(animated: true) { _, completed, error in if error != nil { call.reject("No se pudo imprimir.") } else { call.resolve(["cancelled": !completed]) } }
        }
    }
}

@objc(LectorSpeechPlugin)
class LectorSpeechPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    let identifier = "LectorSpeechPlugin"
    let jsName = "LectorSpeech"
    let pluginMethods: [CAPPluginMethod] = ["voices", "speak", "pause", "resume", "cancel", "metadata"].compactMap { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private let synth = AVSpeechSynthesizer()
    private var current: AVSpeechUtterance?
    private var request = "", held = false
    private var bookMetadata: [String: Any] = [:]
    override func load() {
        synth.delegate = self
        let controls = MPRemoteCommandCenter.shared()
        controls.playCommand.addTarget { [weak self] _ in self?.resumeAudio(); self?.action("play"); return .success }
        controls.pauseCommand.addTarget { [weak self] _ in self?.pauseAudio(); self?.action("pause"); return .success }
        controls.stopCommand.addTarget { [weak self] _ in self?.cancelAudio(); self?.action("stop"); return .success }
    }
    private func event(_ type: String, range: NSRange = NSRange(location: 0, length: 0)) { notifyListeners("speechEvent", data: ["type": type, "id": request, "charIndex": range.location, "charLength": range.length]) }
    private func action(_ value: String) { notifyListeners("speechEvent", data: ["type": "action", "action": value]) }
    private func publish(_ playing: Bool) { var value = bookMetadata; value[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0; MPNowPlayingInfoCenter.default().nowPlayingInfo = value }
    @objc func voices(_ call: CAPPluginCall) { call.resolve(["voices": AVSpeechSynthesisVoice.speechVoices().map { ["name": $0.name, "voiceURI": $0.identifier, "lang": $0.language, "localService": true, "default": $0.identifier == AVSpeechSynthesisVoice(language: Locale.preferredLanguages.first ?? "es")?.identifier] }]) }
    @objc func speak(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.current = nil; self.synth.stopSpeaking(at: .immediate)
            let utterance = AVSpeechUtterance(string: call.getString("text") ?? "")
            utterance.voice = AVSpeechSynthesisVoice(identifier: call.getString("voice") ?? "") ?? AVSpeechSynthesisVoice(language: call.getString("language") ?? "es")
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * Float(call.getDouble("rate") ?? 1)
            utterance.pitchMultiplier = Float(call.getDouble("pitch") ?? 1); utterance.volume = Float(call.getDouble("volume") ?? 1)
            self.request = call.getString("id") ?? ""; self.current = utterance; self.held = call.getBool("paused") ?? false
            if !self.held { try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio); try? AVAudioSession.sharedInstance().setActive(true); self.synth.speak(utterance); self.publish(true) }
            call.resolve()
        }
    }
    private func pauseAudio() { if current != nil { synth.pauseSpeaking(at: .immediate); publish(false) } }
    private func resumeAudio() { if held, let utterance = current { held = false; try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio); try? AVAudioSession.sharedInstance().setActive(true); synth.speak(utterance) } else { synth.continueSpeaking() }; publish(true) }
    private func cancelAudio() { current = nil; held = false; synth.stopSpeaking(at: .immediate); MPNowPlayingInfoCenter.default().nowPlayingInfo = nil; try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation]) }
    @objc func pause(_ call: CAPPluginCall) { DispatchQueue.main.async { self.pauseAudio(); call.resolve() } }
    @objc func resume(_ call: CAPPluginCall) { DispatchQueue.main.async { self.resumeAudio(); call.resolve() } }
    @objc func cancel(_ call: CAPPluginCall) { DispatchQueue.main.async { self.cancelAudio(); call.resolve() } }
    @objc func metadata(_ call: CAPPluginCall) { bookMetadata = [MPMediaItemPropertyTitle: call.getString("title") ?? "", MPMediaItemPropertyArtist: call.getString("artist") ?? ""]; if let data = Data(base64Encoded: call.getString("cover") ?? ""), let image = UIImage(data: data) { bookMetadata[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image } }; call.resolve() }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) { if utterance === current { event("start") } }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString range: NSRange, utterance: AVSpeechUtterance) { if utterance === current { event("boundary", range: range) } }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) { if utterance === current { event("end"); current = nil } }
}

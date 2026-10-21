import { NodeTypes } from 'reactflow'
import { CameraNode } from './CameraNode'
import { ImageClassifierNode } from './ImageClassifierNode'
import { ObjectDetectionNode } from './ObjectDetectionNode'
import { IfNode } from './IfNode'
import { OutputNode } from './OutputNode'
import { MicrophoneNode } from './MicrophoneNode'
import { TextNode } from './TextNode'
import { ImageInputNode } from './ImageInputNode'
import { AndNode, OrNode, NotNode } from './LogicGateNode'
import { TimerNode } from './TimerNode'
import { SceneCameraNode } from './SceneCameraNode'
import { TrashClassifierNode } from './TrashClassifierNode'
import { RoboticArmNode } from './RoboticArmNode'
import { CustomNode } from './CustomNode'
// —————— 新增模块 ——————
import { SpeechRecognitionNode } from './SpeechRecognitionNode'
import { SoundClassificationNode } from './SoundClassificationNode'
import { VolumeDetectorNode } from './VolumeDetectorNode'
import { TextMergeNode } from './TextMergeNode'
import { CounterNode } from './CounterNode'
import { DelayTimerNode } from './DelayTimerNode'
import { TextDisplayNode } from './TextDisplayNode'
import { BuzzerNode } from './BuzzerNode'
import { TTSPlayerNode } from './TTSPlayerNode'
import { LEDIndicatorNode } from './LEDIndicatorNode'
import { NumberDisplayNode } from './NumberDisplayNode'
import { withNodeChrome } from './NodeChrome'

// 每个元件右上角都带「🔧 参数 / ✕ 删除」两个按钮
export const nodeTypes: NodeTypes = {
  camera: withNodeChrome(CameraNode),
  imageClassifier: withNodeChrome(ImageClassifierNode),
  objectDetection: withNodeChrome(ObjectDetectionNode),
  speechRecognition: withNodeChrome(SpeechRecognitionNode),
  soundClassification: withNodeChrome(SoundClassificationNode),
  volumeDetector: withNodeChrome(VolumeDetectorNode),
  if: withNodeChrome(IfNode),
  output: withNodeChrome(OutputNode),
  textDisplay: withNodeChrome(TextDisplayNode),
  buzzer: withNodeChrome(BuzzerNode),
  ttsPlayer: withNodeChrome(TTSPlayerNode),
  ledIndicator: withNodeChrome(LEDIndicatorNode),
  numberDisplay: withNodeChrome(NumberDisplayNode),
  microphone: withNodeChrome(MicrophoneNode),
  textInput: withNodeChrome(TextNode),
  imageInput: withNodeChrome(ImageInputNode),
  and: withNodeChrome(AndNode),
  or: withNodeChrome(OrNode),
  not: withNodeChrome(NotNode),
  timer: withNodeChrome(TimerNode),
  counter: withNodeChrome(CounterNode),
  delayTimer: withNodeChrome(DelayTimerNode),
  textMerge: withNodeChrome(TextMergeNode),
  sceneCamera: withNodeChrome(SceneCameraNode),
  trashClassifier: withNodeChrome(TrashClassifierNode),
  roboticArm: withNodeChrome(RoboticArmNode),
  custom: withNodeChrome(CustomNode),
}

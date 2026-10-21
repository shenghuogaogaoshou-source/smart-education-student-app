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

export const nodeTypes: NodeTypes = {
  camera: CameraNode,
  imageClassifier: ImageClassifierNode,
  objectDetection: ObjectDetectionNode,
  speechRecognition: SpeechRecognitionNode,
  soundClassification: SoundClassificationNode,
  volumeDetector: VolumeDetectorNode,
  if: IfNode,
  output: OutputNode,
  textDisplay: TextDisplayNode,
  buzzer: BuzzerNode,
  ttsPlayer: TTSPlayerNode,
  ledIndicator: LEDIndicatorNode,
  microphone: MicrophoneNode,
  textInput: TextNode,
  imageInput: ImageInputNode,
  and: AndNode,
  or: OrNode,
  not: NotNode,
  timer: TimerNode,
  counter: CounterNode,
  delayTimer: DelayTimerNode,
  textMerge: TextMergeNode,
  sceneCamera: SceneCameraNode,
  trashClassifier: TrashClassifierNode,
  roboticArm: RoboticArmNode,
  custom: CustomNode,
}

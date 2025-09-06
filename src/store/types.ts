// Tipos para el API de medios
export type MediaType = "image" | "audio" | "video";

export interface BaseData {
  id: string;
  name: string;
  type: MediaType;
  duration: number;
  maxDuration: boolean;
  active: boolean;
  item: Partial<MediaItem>;
}

interface ImageData extends BaseData {
  type: "image";
  size: number;
  position: { x: number; y: number };
  randomPosition: boolean;
}

interface VideoData extends BaseData {
  type: "video";
  size: number;
  volume: number;
  position: { x: number; y: number };
  randomPosition: boolean;
}

interface AudioData extends BaseData {
  type: "audio";
  volume: number;
}

// Union type for the Data state
export type TriggerData = ImageData | VideoData | AudioData;
// Type Guards
const isImageData = (Data: TriggerData): Data is ImageData => {
  return Data.type === "image";
};

const isVideoData = (Data: TriggerData): Data is VideoData => {
  return Data.type === "video";
};

const isAudioData = (Data: TriggerData): Data is AudioData => {
  return Data.type === "audio";
};
export const TriggerUtils = {
  isImageData,
  isVideoData,
  isAudioData,
};
export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  name?: string;
  metadata?: {
    [key: string]: any;
  };
}

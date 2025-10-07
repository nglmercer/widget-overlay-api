// Tipos para el API de medios
export type MediaType = "image" | "audio" | "video" | "subtitle"

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  name?: string;
  size?: number; // Size in bytes
  metadata?: {
    [key: string]: any;
  };
}

export interface BaseData {
  id: string;
  name: string;
  duration: number;
  maxDuration: boolean;
  active: boolean;
  item: MediaItem;
}

interface ImageData extends BaseData {
  size: number;
  position: { x: number; y: number };
  randomPosition: boolean;
  item: MediaItem & { type: 'image' };
}

interface VideoData extends BaseData {
  size: number;
  volume: number;
  position: { x: number; y: number };
  randomPosition: boolean;
  item: MediaItem & { type: 'video' };
}

interface AudioData extends BaseData {
  volume: number;
  item: MediaItem & { type: 'audio' };
}

// Union type for the Data state
export type TriggerData = ImageData | VideoData | AudioData;

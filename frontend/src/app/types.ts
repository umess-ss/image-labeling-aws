export type BoundingBox = {
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

export type LabelInstance = {
  BoundingBox?: BoundingBox;
  boundingBox?: BoundingBox;
  Confidence?: number | string;
  confidence?: number | string;
};

export type LabelCategory =
  | string
  | {
      Name?: string;
      name?: string;
    };

export type FaceResult = {
  name?: string;
  confidence?: number | string;
  Confidence?: number | string;
  boundingBox?: BoundingBox;
  BoundingBox?: BoundingBox;
};

export type LabelResult = {
  name?: string;
  Name?: string;
  confidence?: string;
  Confidence?: number | string;
  Instances?: LabelInstance[];
  instances?: LabelInstance[];
  Categories?: LabelCategory[];
  categories?: LabelCategory[];
};

export type ResultResponse = {
  imageId: string;
  bucket?: string;
  status?: string;
  objectKey?: string;
  imageUrl?: string;
  presignedImageUrl?: string;
  labels?: LabelResult[];
  faces?: FaceResult[];
  createdAt?: string;
};

export type PastUploadsResponse = {
  items?: ResultResponse[];
  count?: number;
};

export type UploadUrlResponse = {
  imageId: string;
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
};

export type ActiveTab = "upload" | "past";
export type LabelType = "Object" | "Person" | "Scene" | "General";

export type NormalizedBox = {
  Left: number;
  Top: number;
  Width: number;
  Height: number;
};

export type BoundingBoxLabel = {
  id: string;
  name: string;
  confidence: number;
  box: NormalizedBox;
  labelIndex: number;
};

import { useRef } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";

export function useCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  async function takePicture(): Promise<string> {
    const photo = await cameraRef.current?.takePictureAsync({
      base64: true,
      quality: 0.65,
      skipProcessing: true,
    });
    if (!photo?.base64) throw new Error("Failed to capture image");
    return `data:image/jpeg;base64,${photo.base64}`;
  }

  return { cameraRef, permission, requestPermission, takePicture };
}

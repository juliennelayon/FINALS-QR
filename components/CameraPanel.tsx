import { useState } from "react";
import { View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, s, Txt } from "./Kit";
export default function CameraPanel({
  onScan,
  disabled,
}: {
  onScan: (data: string) => void;
  disabled: boolean;
}) {
  const [permission, request] = useCameraPermissions(),
    [torch, T] = useState(false);
  if (!permission?.granted)
    return (
      <View style={s.card}>
        <Txt>
          Allow camera access to scan the organizer’s QR, or select Enter Event
          Code above.
        </Txt>
        <Button title="Allow Camera" onPress={() => void request()} />
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          height: 330,
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: "#064E3B",
        }}
      >
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={disabled ? undefined : ({ data }) => onScan(data)}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 200,
            height: 200,
            left: "50%",
            top: "50%",
            marginLeft: -100,
            marginTop: -100,
            borderWidth: 3,
            borderColor: "#6EE7B7",
            borderRadius: 20,
          }}
        />
      </View>
      <Button
        title={torch ? "Turn Flashlight Off" : "Turn Flashlight On"}
        secondary
        onPress={() => T(!torch)}
      />
    </View>
  );
}

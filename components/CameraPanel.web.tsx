import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import jsQR from "jsqr";
import { Button, s, Txt } from "./Kit";
// Bundled QR decoder: no CDN script or third-party worker is loaded by the login/manual page.
export default function CameraPanel({
  onScan,
  disabled,
}: {
  onScan: (data: string) => void;
  disabled: boolean;
}) {
  const video = useRef<HTMLVideoElement | null>(null),
    stream = useRef<MediaStream | null>(null),
    callback = useRef(onScan),
    blocked = useRef(disabled),
    canvas = useRef<HTMLCanvasElement | null>(null),
    alive = useRef(true);
  callback.current = onScan;
  blocked.current = disabled;
  const [started, S] = useState(false),
    [error, E] = useState(""),
    [torch, T] = useState(false),
    [canTorch, CT] = useState(false);
  useEffect(() => {
    alive.current = true;
    let frame = 0,
      last = 0;
    const loop = (time: number) => {
      if (!alive.current) return;
      const v = video.current;
      if (v && v.readyState >= 2 && !blocked.current && time - last > 220) {
        last = time;
        const c =
          canvas.current || (canvas.current = document.createElement("canvas"));
        const scale = Math.min(1, 640 / v.videoWidth);
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx && c.width && c.height) {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const pixels = ctx.getImageData(0, 0, c.width, c.height);
          const result = jsQR(pixels.data, c.width, c.height, {
            inversionAttempts: "dontInvert",
          });
          if (result) callback.current(result.data);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      alive.current = false;
      cancelAnimationFrame(frame);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, []);
  useEffect(() => {
    if (started && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => {});
    }
  }, [started]);
  async function start() {
    E("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Use HTTPS or localhost for camera access. Manual event-code entry is available above.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      CT(!!(media.getVideoTracks()[0].getCapabilities() as any).torch);
      S(true);
    } catch (e: any) {
      E(e.message || "Camera could not start. Use Enter Event Code instead.");
    }
  }
  return (
    <View style={{ gap: 12 }}>
      {!started ? (
        <View style={s.card}>
          <Txt>
            Start your camera to scan the event QR. You can also enter the event
            code manually.
          </Txt>
          <Button title="Start Camera" onPress={() => void start()} />
        </View>
      ) : (
        <View
          style={{
            height: 330,
            borderRadius: 22,
            overflow: "hidden",
            backgroundColor: "#064E3B",
          }}
        >
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
      )}
      {canTorch && (
        <Button
          title={torch ? "Turn Flashlight Off" : "Turn Flashlight On"}
          secondary
          onPress={async () => {
            try {
              await stream.current
                ?.getVideoTracks()[0]
                .applyConstraints({ advanced: [{ torch: !torch }] } as any);
              T(!torch);
            } catch {
              E("Flashlight is not supported by this browser.");
            }
          }}
        />
      )}
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

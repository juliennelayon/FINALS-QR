import * as ImagePicker from "expo-image-picker";

export async function pickImage(
  crop: boolean,
  aspect: [number, number] = [1, 1],
) {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Allow photo access to choose an image.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: crop,
    aspect,
    quality: 0.8,
  });

  return result.canceled ? null : result.assets[0].uri;
}
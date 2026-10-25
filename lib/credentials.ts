import { authStorage } from "./storage";
export async function clearCreds() {
  await authStorage.removeItem("saved_login_creds");
}

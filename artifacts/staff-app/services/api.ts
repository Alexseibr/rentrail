import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  REFRESH_TOKEN: "auth_refresh_token",
  USER: "auth_user",
  COMPANY_ID: "auth_company_id",
  BRANCH_ID: "auth_branch_id",
};

export { STORAGE_KEYS };

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function storeTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
    [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
  ]);
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.COMPANY_ID,
    STORAGE_KEYS.BRANCH_ID,
  ]);
}

export async function getCompanyId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.COMPANY_ID);
}

export async function setCompanyId(id: string) {
  await AsyncStorage.setItem(STORAGE_KEYS.COMPANY_ID, id);
}

export async function getBranchId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.BRANCH_ID);
}

export async function setBranchId(id: string | null) {
  if (id) {
    await AsyncStorage.setItem(STORAGE_KEYS.BRANCH_ID, id);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.BRANCH_ID);
  }
}

export function maybeParse(json: string) {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error("bad json", error);
    return null;
  }
}

export function safeParse(json: string) {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error("parse failed", error);
    return null;
  }
}

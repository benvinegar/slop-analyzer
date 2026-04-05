function getData(id: string) {
  return Promise.resolve(id);
}

export async function fetchData(id: string) {
  return await getData(id);
}

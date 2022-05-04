const CHUNK_SIZE = 1 * 1024 * 1024;

const createFileChunk = (file, size = CHUNK_SIZE) => {
  const chunks = [];
  let cur = 0;

  while (cur < file.size) {
    chunks.push({
      index: cur,
      file: file.slice(cur, cur + size),
    });

    cur += size;
  }

  return chunks;
};

export default createFileChunk;

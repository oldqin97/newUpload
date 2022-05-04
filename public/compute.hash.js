self.importScripts('/spark-md5.min.js');

self.onmessage = e => {
  const { fileChunksList = [] } = e.data;
  const spark = new self.SparkMD5.ArrayBuffer();
  let percentage = 0;
  let count = 0;

  const loadNext = index => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(fileChunksList[index].file);

    reader.onload = e => {
      count++;
      spark.append(e.target.result);
      if (count === fileChunksList.length) {
        self.postMessage({
          percentage: 100,
          hash: spark.end(),
        });

        self.close();
      } else {
        percentage = Math.floor(
          (percentage += 100 / fileChunksList.length),
        );
        self.postMessage({
          percentage,
        });

        // recursion loadNext
        loadNext(count);
      }
    };
  };

  loadNext(0);
};

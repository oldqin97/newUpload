const sendRequest = (forms, max = 3) => {
  return new Promise((resolve, reject) => {
    const len = forms.length;
    let counter = 0;
    const retryArr = [];

    forms.forEach(item => (item.status = Status.wait));
    const start = async () => {
      while (counter < len && max > 0) {
        max--;
        let idx = forms.findIndex(v => {
          return v.status == Status.wait || v.status == Status.error;
        });

        if (idx === -1) {
          // 没有失败状态和等待状态
          return reject();
        }

        let { formData, index } = forms[idx];

        await request({
          url: '/api/upload-chunk',
          data: formData,
          method: 'post',
          onProgress: createProgressHandle(chunkData.value[index]),
          requestList: requestList.value,
        })
          .then(() => {
            forms[idx].status = Status.done;
            max++; // 释放通道
            counter++;
            if (counter === len) resolve();
          })
          .catch(() => {
            forms[idx].status = Status.error;
            if (typeof retryArr[index] !== 'number') {
              $message({
                type: 'warning',
                message: `第 ${index} 块上传失败`,
              });
              retryArr[index] = 0;
            }

            retryArr[index]++;
            if (retryArr[index] > 3) {
              $message({
                type: 'warning',
                message: `第 ${index} 块上传失败`,
              });
              forms[idx].status = Status.fail;
            }
            max++; // 释放通道
          });
      }
    };
    start();
  });
};

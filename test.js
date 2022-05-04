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

        if (idx == -1) {
          // 找不到失败状态和等待状态
          return reject();
        }
        let { formData, index } = forms[idx];
        await request({
          url: '/api/upload-chunk',
          method: 'post',
          data: formData,
          onProgress: createProgressHandle(chunkData.value[index]),
          requestList: requestList.value,
        })
          .then(() => {
            forms[idx].status = Status.done;
            max++; // 释放通道
            counter++;
            if (counter === len) {
              resolve();
            }
          })
          .catch(() => {
            forms[idx].status = Status.error;
            if (typeof retryArr[index] !== 'number') {
              //  $message(
              //     `第 ${index} 个块上传失败，系统准备重试`,
              //   );
              retryArr[index] = 0;
            }
            // 次数累加
            retryArr[index]++;
            // 一个请求报错3次的
            if (retryArr[index] > 3) {
              // this.$message.error(
              //   `第 ${index} 个块重试多次无效，放弃上传`,
              // );
              forms[idx].status = Status.fail;
            }
            max++; // 释放通道
          });
      }
    };
    start();
  });
};

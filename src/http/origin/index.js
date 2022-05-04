const setHeader = (xhr, headers) => {
  const resArr = Object.keys(headers);

  for (let key of resArr) {
    xhr.setRequestHeader(key, headers[key]);
  }
};

const request = ({
  url,
  method = 'POST',
  data,
  headers = {},
  onProgress = e => e,
  requestList = [],
}) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 监听上传进度
    xhr.upload.onprogress = onProgress;
    xhr.open(method, url);

    // Object.keys(headers).forEach(key => {
    //   xhr.setRequestHeader(key, headers[key]);
    // });
    setHeader(xhr, headers);

    xhr.send(data);

    xhr.onload = e => {
      const xhrIDX = requestList.findIndex(item => item === xhr);
      requestList.splice(xhrIDX, 1);
      resolve({ data: JSON.parse(e.target.response) });
      // resolve({ data: e.target.response });
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          ('success');
        } else {
          onProgress({ loaded: 0, total: 100 });
          reject(xhr.statusText);
        }
      }
    };

    requestList.push(xhr);
  });
};

export default request;

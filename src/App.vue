<script setup>
import { ref, getCurrentInstance, onMounted } from 'vue';
import SparkMD5 from 'spark-md5';

import { isImage, createFileChunk } from '@/utils';
import request from '@/http/origin';
import { async } from 'q';

const CHUNK_SIZE = 1 * 1024 * 1024;
const Status = { wait: 1, error: 2, done: 3, fail: 4 };

const { $message } =
  getCurrentInstance().appContext.config.globalProperties;

const fileData = ref();
const chunkData = ref();
const hash = ref();
// web worker
const worker = ref();
const hashPercentage = ref(0);

const requestList = ref([]);

const uploadPercentage = computed(() => {
  if (!fileData.value || !chunkData.value.length) {
    return 0;
  }

  const loaded = chunkData.value
    .map(item => item.size * item.percentage)
    .reduce((acc, cur) => acc + cur, 0);

  return Number(parseInt(loaded / fileData.value.size).toFixed(1));
});



// 添加拖拽事件
const dragRef = ref();
const bindEvent = () => {
  dragRef.value.addEventListener('dragover', e => {
    dragRef.value.style.borderColor = 'orange';
    e.preventDefault();
  });

  dragRef.value.addEventListener('dragleave', e => {
    dragRef.value.style.borderColor = '#ddd';
    e.preventDefault();
  });

  dragRef.value.addEventListener('drop', e => {
    e.preventDefault();
    dragRef.value.style.borderColor = '#ddd';
    const fileList = e.dataTransfer.files;
    fileData.value = fileList[0];
  });
};

onMounted(()=>{
  bindEvent()
})


// web-worker计算hash
const calculateHash = fileChunksList => {
  return new Promise(resolve => {
    worker.value = new Worker('/compute.hash.js');
    worker.value.postMessage({ fileChunksList });
    worker.value.onmessage = e => {
      const { percentage, hash } = e.data;
      hashPercentage.value = percentage;
      if (hash) {
        resolve(hash);
      }
    };
  });
};
// 浏览器空闲时间计算hash
const calculateHashIdle = fileChunksList => {
  return new Promise(resolve => {
    const spark = new SparkMD5.ArrayBuffer();
    let count = 0;

    // 根据文件内容追加计算
    const appendToSpark = async file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onload = e => {
          spark.append(e.target.result);
          resolve();
        };
      });
    };

    const workLoop = async deadline => {
      // 有任务且当前帧还没结束
      while (
        count < fileChunksList.length &&
        deadline.timeRemaining() > 1
      ) {
        await appendToSpark(fileChunksList[count].file);
        count++;
        if (count < fileChunksList.length) {
          // computing
          hashPercentage.value = Number(
            ((100 * count) / fileChunksList.length).toFixed(2),
          );
          // console.log(hashPercentage.value);
        } else {
          // computed
          hashPercentage.value = 100;
          resolve(spark.end());
        }
      }

      window.requestIdleCallback(workLoop);
    };

    window.requestIdleCallback(workLoop);
  });
};

// 监听 文件上传
const handleFileChange = async e => {
  const [file] = e.target.files;

  if (!file) {
    fileData.value = null;
    return;
  }

  // 校验文件格式 jpg/gif/png
  // if (!(await isImage(file))) {
  //   $message({
  //     showClose: true,
  //     message: '该文件不是图片格式',
  //     type: 'error',
  //   });
  //   return;
  // }

  fileData.value = file;
};

// 监听 点击
const handleClick = async () => {
  if (!fileData.value) {
    $message({
      showClose: true,
      message: '请上传文件',
      type: 'warning',
    });
    return;
  }

  // 生成切片数组
  const chunks = await createFileChunk(fileData.value);

  // 计算hash

  // hash.value = await calculateHash(chunks);
  hash.value = await calculateHashIdle(chunks);

  // 根据hash判断是否可以秒传

  const {
    data: { shouldUpload, uploadedList },
  } = await verifyUpload(fileData.value.name, hash.value);

  if (!shouldUpload) {
    $message({
      showClose: true,
      message: '秒传', //
      type: 'success',
    });
    return;
  }

  // 构建chunkData 添加下标以及上传进度, 每一个chunk的上传进度
  chunkData.value = chunks.map(({ file }, index) => ({
    chunk: file,
    size: file.size,
    chunkHash: `${hash.value}-${index}`,
    fileHash: hash.value,
    index,
    percentage: uploadedList.includes(`${hash.value}-${index}`)
      ? 100
      : 0,
  }));

  await uploadChunks(uploadedList);
  $message({
    type: 'success',
    message: '上传成功',
    showClose: true,
  });
};

// 对每一个chunk 设置它的百分比
const createProgressHandle = item => {
  return e => {
    item.percentage = parseInt((e.loaded / e.total) * 100);
  };
};

// 上传切片文件
const uploadChunks = async (uploadedList = []) => {
  // 构造请求列表
  const AllRequest = chunkData.value
    .filter(chunk => !uploadedList.includes(chunk.chunkHash))
    .map(({ chunk, chunkHash, index, fileHash }) => {
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkHash', chunkHash);
      formData.append('fileHash', fileHash);
      return { formData, index };
    });
  // .map(({ formData, index }) => {
  //   request({
  //     url: '/api/upload-chunk',
  //     data: formData,
  //     onProgress: createProgressHandle(chunkData.value[index]),
  //     requestList: requestList.value,
  //   });
  // });
  // 全部发送
  // await Promise.all(AllRequest);

  // 控制并非
  await sendRequest(AllRequest, 3);

  await mergeRequest();
};

const mergeRequest = async () => {
  await request({
    url: '/api/merge',
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({
      filename: fileData.value.name,
      fileSize: fileData.value.size,
      size: CHUNK_SIZE,
      hash: hash.value,
    }),
  });
};

const sendRequest = (forms, max = 3) => {
  return new Promise((resolve, reject) => {
    const len = forms.length;
    let counter = 0; // 已经发送成功的请求
    const retryArr = []; // 记录错误的次数
    // 一开始将所有的表单状态置为等待
    forms.forEach(item => (item.status = Status.wait));
    const start = async () => {
      // 有请求，有通道
      while (counter < len && max > 0) {
        max--; // 占用通道
        // 只要是没有完成的我们就重发
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

// 判断文件是否可以秒传
const verifyUpload = async (filename, fileHash) => {
  const translateData = JSON.stringify({ filename, fileHash });
  const { data } = await request({
    url: '/api/verify',
    headers: { 'content-type': 'application/json' },
    data: translateData,
  });
  return data;
};
</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <div class="input-wrapper" ref="dragRef" draggable="true">
      <input type="file" @change="handleFileChange" />
    </div>
    <el-button @click="handleClick">上传</el-button>

    <div v-show="hashPercentage > 0">
      <h3>计算文件的hash</h3>
      <el-progress
        :text-inside="true"
        :stroke-width="20"
        :percentage="hashPercentage"
        status="success"
      />
    </div>

    <div v-show="uploadPercentage > 0">
      <h3>文件上传进度</h3>
      <el-progress
        :text-inside="true"
        :stroke-width="20"
        status="success"
        :percentage="uploadPercentage"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.input-wrapper {
  position: relative;
  width: 200px;
  height: 200px;
  border: 2px dashed #ddd;
  input {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  &::before {
    content: '上传文件';
    position: absolute;
    display: block;
    width: 50%;
    height: 50%;
    top: 50%;
    left: 50%;
    transform: translateY(-50%) translateX(-50%);
    text-align: center;
    line-height: 100px;
  }
}
</style>

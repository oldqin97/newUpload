const blobToString = async blob => {
  return new Promise(resolve => {
    const reader = new FileReader();

    reader.onload = function () {
      const res = reader.result
        .split('')
        .map(v => v.charCodeAt())
        .map(v => v.toString(16).toUpperCase())
        .map(v => v.padStart(2, '0'))
        .join(' ');
      resolve(res);
    };

    reader.readAsBinaryString(blob);
  });
};

const isGif = async file => {
  const res = await blobToString(file.slice(0, 6));
  const isGif =
    res == '47 49 46 38 39 61' || res == '47 49 46 38 37 61';

  return isGif;
};

const isPng = async file => {
  const res = await blobToString(file.slice(0, 8));
  const isPng = res === '89 50 4E 47 0D 0A 1A 0A';

  return isPng;
};

const isJpg = async file => {
  const len = file.size;
  const start = await blobToString(file.slice(0, 2));
  const tail = await blobToString(file.slice(-2, len));
  const isJpg = start === 'FF D8' && tail === 'FF D9';

  return isJpg;
};

const isImage = async file => {
  return (await isGif(file)) || (await isPng(file)) || isJpg(file);
};



export default isImage;

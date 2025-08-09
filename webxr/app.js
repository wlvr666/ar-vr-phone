if ('xr' in navigator) {
  navigator.xr.isSessionSupported('immersive-ar').then(supported => {
    console.log(supported ? "WebXR supported!" : "WebXR not supported.");
  });
}

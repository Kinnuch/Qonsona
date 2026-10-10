// seek-bzip 没有类型声明，这里只写用到的一个函数
declare module 'seek-bzip' {
  const Bunzip: { decode(input: Uint8Array): Buffer }
  export default Bunzip
}

declare module 'web-worker:*' {
  const WorkerFactory: {
    new (options?: WorkerOptions): Worker
    prototype: Worker
  }
  export = WorkerFactory
}

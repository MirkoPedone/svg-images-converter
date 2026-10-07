declare module 'imagetracerjs' {
  export function imageToSVG(
    url: string,
    callback: (svgStr: string) => void,
    options?: any
  ): void;
  export function imageToTracedata(
    url: string,
    callback: (tracedata: any) => void,
    options?: any
  ): void;
  export const optionpresets: any;
  export function appendSVGString(svgstr: string, parentid: string): void;
}

declare module "qrcode" {
  export interface ToStringOptions {
    type?: string;
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  const QRCode: {
    toString(value: string, options?: ToStringOptions): Promise<string>;
  };

  export default QRCode;
}

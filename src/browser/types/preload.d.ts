
declare namespace electronAPI {
  let setTitle: (title: string) => void;
  let appInfo: {
    nodeVersion: string;
    chromeVersion: string;
    electronVersion: string;
  };
}
type Data = Record<string, string | number | boolean>;
type Umami = { track: (name: string, data?: Data) => void };

const early: [string, Data | undefined][] = [];

/** Sends an Umami event. The tracker is deferred, so anything fired before the page has loaded waits for it; with no tracker it is dropped. */
export const track = (name: string, data?: Data) => {
  const umami = (window as unknown as { umami?: Umami }).umami;
  if (umami) umami.track(name, data);
  else if (document.readyState !== 'complete') early.push([name, data]);
};

addEventListener('load', () => early.splice(0).forEach(([name, data]) => track(name, data)));

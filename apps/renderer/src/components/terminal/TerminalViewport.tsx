import { useEffect, useRef } from "react";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import "@xterm/xterm/css/xterm.css";

interface TerminalViewportProps {
  readonly content: string;
  readonly title?: string;
}

export function TerminalViewport({
  content,
  title = "EMA Runtime Terminal",
}: TerminalViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!hostRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      cursorStyle: "bar",
      convertEol: true,
      fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12,
      lineHeight: 1.4,
      letterSpacing: 0.2,
      scrollback: 10000,
      disableStdin: true,
      theme: {
        background: "#070d15",
        foreground: "#d9f1ff",
        cursor: "#7dd3fc",
        cursorAccent: "#081019",
        black: "#0b1420",
        red: "#ff7b72",
        green: "#8ddb8c",
        yellow: "#ffd580",
        blue: "#8bc4ff",
        magenta: "#d2a8ff",
        cyan: "#79e2f2",
        white: "#d9f1ff",
        brightBlack: "#5c6d80",
        brightRed: "#ffa198",
        brightGreen: "#b8f7b6",
        brightYellow: "#ffe7a8",
        brightBlue: "#b5d8ff",
        brightMagenta: "#e7c1ff",
        brightCyan: "#b8f7ff",
        brightWhite: "#ffffff",
        selectionBackground: "rgba(125, 211, 252, 0.24)",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitRef.current = fitAddon;

    const observer = new ResizeObserver(() => {
      fitRef.current?.fit();
    });
    observer.observe(hostRef.current);

    return () => {
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    terminal.reset();
    terminal.clear();
    terminal.write(`\u001b]0;${title}\u0007`);
    terminal.write(content.length > 0 ? content.replace(/\r?\n/g, "\r\n") : "\r\n");
    terminal.scrollToBottom();
  }, [content, title]);

  return (
    <div
      ref={hostRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    />
  );
}

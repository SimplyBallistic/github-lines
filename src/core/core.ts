import * as fetch from "node-fetch";
import { isFilled } from "ts-is-present"; // https://github.com/microsoft/TypeScript/issues/16069

import { LineData, IMessageData } from "./types_core";

const supportedSourcesRegex = {
  GitHub: /https?:\/\/github\.com\/([a-zA-Z0-9-_]+\/[A-Za-z0-9_.-]+)\/blob\/(.+?)\/(.+?)#L(\d+)[-~]?L?(\d*)/g,
  Gist: /https?:\/\/gist\.github\.com\/([a-zA-Z0-9-_]+\/[0-9a-zA-Z]+)\/?([0-9a-z]*)\/*#file-(.+?)-L(\d+)[-~]?L?(\d*)/g,
  GitLab: /https?:\/\/gitlab\.com\/([a-zA-Z0-9-_]+\/[A-Za-z0-9_.-]+)\/-\/blob\/(.+?)\/(.+?)#L(\d+)-?(\d*)/g
};
type SupportedSources = keyof typeof supportedSourcesRegex;

export class Core {
  readonly GITHUB_TOKEN: string | undefined;

  readonly authHeaders: { [key: string]: string };

  constructor(token: string | undefined) {
    this.GITHUB_TOKEN = token;

    this.authHeaders = {};
    if (this.GITHUB_TOKEN) {
      this.authHeaders.Authorization = `token ${this.GITHUB_TOKEN}`;
    }
  }

  static formatIndent(str: string): string {
    const lines = str.replace(/\t/g, "    ").split("\n"); // replaces tabs with 4 spaces
    const ignored: Array<number> = []; // list of blank lines
    let minSpaces = Infinity; // the smallest amount of spaces in any line
    const newLines: Array<string> = []; // array of the returned lines
    lines.forEach((line, idx) => {
      const leadingSpaces = line.search(/\S/);
      if (leadingSpaces === -1) {
        ignored.push(idx);
      } else if (leadingSpaces < minSpaces) {
        minSpaces = leadingSpaces;
      }
    });

    lines.forEach((line, idx) => {
      if (ignored.includes(idx)) {
        newLines.push(line);
      } else {
        newLines.push(line.substring(minSpaces));
      }
    });

    return newLines.join("\n");
  }

  async handleMessage(msg: string): Promise<IMessageData> {
    const returned: Array<Promise<LineData | null>> = [];

    Object.entries(supportedSourcesRegex).forEach(([type, regex]) => {
      const matches = msg.matchAll(regex);
      if (matches) {
        for (const match of matches) {
          // https://github.com/microsoft/TypeScript/issues/38520 casting needed until TS types Object utility methods better
          returned.push(this.handleMatch(match, type as SupportedSources));
        }
      }
    });

    const filtered = (await Promise.all(returned)).filter(isFilled);

    let totalLines = 0;
    filtered.forEach((el) => {
      totalLines += el.lineLength;
    });
    return {
      msgList: filtered,
      totalLines
    };
  }

  /**
   * Handles a match for lines
   * @param {Array} match The match list (as returned by a regex)
   * In the context of GitHub Gists, repoName is <username>/<gist-id> & branchName is the revision ID
   * @param {String} type The webiste the match was detected in
   * @returns {?Array} an array with the message to return and the number of lines (null if failed)
   */
  async handleMatch(
    [fullLink, repoName, branchName, filePath, lineStart, lineEnd]: Array<string>,
    type: SupportedSources
  ): Promise<LineData | null> {
    let lines;
    let fileName = filePath;
    if (type === "GitHub") {
      const resp = await fetch(`https://raw.githubusercontent.com/${repoName}/${branchName}/${fileName}`);
      if (!resp.ok) {
        return null; // TODO: fallback to API
      }
      const text = await resp.text();
      lines = text.split("\n");
    } else if (type === "GitLab") {
      const resp = await fetch(`https://gitlab.com/${repoName}/-/raw/${branchName}/${fileName}`);
      if (!resp.ok) {
        return null; // TODO: fallback to API
      }
      const text = await resp.text();
      lines = text.split("\n");
    } else if (type === "Gist") {
      fileName = fileName.replace(/-([^-]*)$/, ".$1");
      let text;
      if (branchName.length) {
        const resp = await fetch(`https://gist.githubusercontent.com/${repoName}/raw/${branchName}/${fileName}`);
        if (!resp.ok) {
          return null; // TODO: fallback to API
        }
        text = await resp.text();
      } else {
        const resp = await fetch(`https://api.github.com/gists/${repoName.split("/")[1]}`, {
          method: "GET",
          headers: this.authHeaders
        });
        if (!resp.ok) {
          return null;
        }
        const json = await resp.json();
        text = json.files[fileName]?.content;
        if (!text) {
          // if the gist exists but not the file
          return null;
        }
      }
      lines = text.split("\n");
    } else {
      console.log("Wrong type sent to handleMatch!");
      return null;
    }

    let toDisplay;
    let lineLength;
    // if lineEnd doesn't exist
    if (!lineEnd.length || lineStart === lineEnd) {
      if (parseInt(lineStart, 10) > lines.length || parseInt(lineStart, 10) === 0) return null;
      toDisplay = lines[parseInt(lineStart, 10) - 1].trim().replace(/``/g, "`\u200b`"); // escape backticks
      lineLength = 1;
    } else {
      let start = parseInt(lineStart, 10);
      let end = parseInt(lineEnd, 10);
      if (end < start) [start, end] = [end, start];
      if (end > lines.length) end = lines.length;
      if (start === 0) start = 1;
      lineLength = end - start + 1;
      toDisplay = Core.formatIndent(lines.slice(start - 1, end).join("\n")).replace(/``/g, "`\u200b`"); // escape backticks
    }
    // add additional info for users & reaction code
    toDisplay = Core.formatIndent(
      [`Fetched From ${type}`, `${repoName} - ${branchName}`, `${filePath} L${lineStart}-${lineEnd || lineStart}`].map(
        (info) => `//${info}\n`
      ) + toDisplay
    );

    // file extension for syntax highlighting
    let extension = (fileName.includes(".") ? fileName.split(".") : [""]).pop(); // .pop returns the last element
    if (!extension || extension.match(/[^0-9a-z]/i)) extension = ""; // alphanumeric extensions only

    // const message = `\`\`\`${toDisplay.search(/\S/) !== -1 ? extension : " "}\n${toDisplay}\n\`\`\``;
    return new LineData(lineLength, extension, toDisplay);
  }
}

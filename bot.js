process.env.NTBA_FIX_319 = 1;
require("dotenv").config();

const fetch = require("node-fetch");

const DiscordBot = require("discord.js");
const { TOKEN } = process.env;
const bot = new DiscordBot.Client();
bot.login(TOKEN);

const PREFIX = ";";

/* eslint-disable no-use-before-define */
const COMMANDS = {
  help: (msg) => handleHelp(msg),
  about: (msg) => handleAbout(msg),
  invite: (msg) => /* handleTopgg(msg) */msg.reply("https://discord.com/api/oauth2/authorize?client_id=708282735227174922&permissions=10240&scope=bot"),
  topgg: (msg) => handleTopgg(msg),
  vote: (msg) => handleTopgg(msg),
  stats: (msg) => handleAbout(msg),
  ping: (msg) => handlePing(msg),
  github: (msg) => handleGithubCommand(msg),
  source: (msg) => handleGithubCommand(msg)
};
/* eslint-enable no-use-before-define */

function convertMS(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds = (seconds % 60).toString();
  let hours = Math.floor(minutes / 60);
  minutes = (minutes % 60).toString();
  const days = Math.floor(hours / 24);
  hours = (hours % 24).toString();

  if (hours.length === 1) hours = `0${hours}`;
  if (minutes.length === 1) minutes = `0${minutes}`;
  if (seconds.length === 1) seconds = `0${seconds}`;

  let dayStr = "";
  if (days > 1) {
    dayStr = `${days} days, `;
  } else if (days === 1) {
    dayStr = "1 day, ";
  }

  return `${dayStr}${hours}:${minutes}:${seconds}`;
}

function formatIndent(str) {
  const lines = str.replace(/\t/g, "    ").split("\n");
  const ignored = [];
  let minSpaces = Infinity;
  const newLines = [];
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

async function handleMatch(msg, match, type) {
  let lines;
  if (type === "GitHub") {
    const resp = await fetch(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`);
    const text = await resp.text();
    lines = text.split("\n");
  } else if (type === "GitLab") {
    const resp = await fetch(`https://gitlab.com/${match[1]}/-/raw/${match[2]}/${match[3]}`);
    const text = await resp.text();
    lines = text.split("\n");
  } else if (type === "Gist") {
    match[3] = match[3].replace("-", "."); // eslint-disable-line no-param-reassign
    let text;
    if (match[2].length) {
      const resp = await fetch(`https://gist.githubusercontent.com/${match[1]}/raw/${match[2]}/${match[3]}`);
      text = await resp.text();
    } else {
      const resp = await fetch(`https://api.github.com/gists/${match[1].split("/")[1]}`);
      const json = await resp.json();
      text = json.files[match[3]].content;
    }
    lines = text.split("\n");
  } else {
    console.log("Wrong type sent to handleMatch");
    return;
  }

  let toDisplay;
  if (!match[5].length || match[4] === match[5]) {
    if (parseInt(match[4], 10) > lines.length || parseInt(match[4], 10) === 0) return;
    toDisplay = lines[parseInt(match[4], 10) - 1].trim();
  } else {
    let start = parseInt(match[4], 10);
    let end = parseInt(match[5], 10);
    if (end < start) [start, end] = [end, start];
    if (end > lines.length) end = lines.length;
    if (start === 0) start = 1;
    toDisplay = formatIndent(lines.slice(start - 1, end).join("\n"));
  }

  msg.suppressEmbeds(true);
  setTimeout(() => msg.suppressEmbeds(true), 2000); // make sure to suppress the embed

  if (toDisplay.length >= 1990) { // not 2000 because of markdown characters and stuff
    msg.channel.send(
      "Sorry but there is a 2000 character limit on Discord, so we were unable to display the desired snippet. " +
      "Please choose a smaller snippet or break it up into smaller chunks"
    );
    return;
  }

  const extension = match[3].includes(".") ? match[3].split(".") : [""];
  msg.channel.send(`\`\`\`${toDisplay.search(/\S/) !== -1 ? extension[extension.length - 1] : " "}\n${toDisplay}\`\`\``);
}

async function handleAbout(msg) {
  const botApp = await bot.fetchApplication();
  const aboutEmbed = new DiscordBot.MessageEmbed()
    .setTitle("About GitHub Lines")
    .setDescription("GitHub Lines is a bot that displays one or more lines when mentioned in a GitHub (or GitLab) link")
    // .setThumbnail("IMAGE HERE")
    .addFields({
      name: "Guild Count",
      value: bot.guilds.cache.size,
      inline: true
    }, {
      name: "User Count",
      value: bot.users.cache.size,
      inline: true
    }, {
      name: "Uptime",
      value: convertMS(bot.uptime),
      inline: true
    }, {
      name: "Latency",
      value: `${bot.ws.ping}ms`,
      inline: true
    })
    .setFooter(`Made by ${botApp.owner.tag}`, botApp.owner.avatarURL());

  msg.channel.send(aboutEmbed);
}

function handleTopgg(msg) {
  msg.channel.send("We appreciate votes :heart: https://top.gg/bot/708282735227174922");
}

function handleGithubCommand(msg) {
  msg.channel.send("Stars are appreciated :heart: https://github.com/diogoscf/github-lines");
}

function handleHelp(msg) {
  const helpEmbed = new DiscordBot.MessageEmbed()
    .setTitle("Help Info")
    .setDescription("GitHub Lines runs automatically, without need for configuration! Here are some commands you can use")
    // .setThumbnail("IMAGE HERE")
    .addFields({
      name: "**__Commands__**",
      value: "\u200b",
      inline: false
    }, {
      name: "`;about`",
      value: "Info about the bot",
      inline: false
    }, {
      name: "`;invite` or `;topgg`",
      value: "Link to the bot's top.gg page",
      inline: false
    }, {
      name: "`;help`",
      value: "Return this message",
      inline: false
    }, {
      name: "`;github` or `;source`",
      value: "Link GitHub source",
      inline: false
    }, {
      name: "`;ping`",
      value: "Check bot latency",
      inline: false
    });

  msg.channel.send(helpEmbed);
}

async function handlePing(msg) {
  const pingMsg = await msg.channel.send("Ping?");
  pingMsg.edit(`Pong! Latency is ${pingMsg.createdTimestamp - msg.createdTimestamp}ms. API Latency is ${bot.ws.ping}ms`);
}

bot.on("ready", () => {
  bot.user.setActivity("for GitHub links", {
    type: "WATCHING"
  });
});

bot.on("message", async (msg) => {
  // prevent replying to own messages
  if (msg.author.id === bot.user.id) {
    return;
  }

  const githubMatch = msg.content.match(/https?:\/\/github.com\/([a-zA-Z0-9-_]+\/[A-Za-z0-9_.-]+)\/blob\/(.+)\/(.+)#L(\d+)-?L?(\d*)/i);
  if (githubMatch) handleMatch(msg, githubMatch, "GitHub");

  const gitlabMatch = msg.content.match(/https?:\/\/gitlab.com\/([a-zA-Z0-9-_]+\/[A-Za-z0-9_.-]+)\/-\/blob\/(.+)\/(.+)#L(\d+)-?(\d*)/i);
  if (gitlabMatch) handleMatch(msg, gitlabMatch, "GitLab");

  const gistMatch = msg.content.match(/https?:\/\/gist.github.com\/([a-zA-Z0-9-_]+\/[0-9a-zA-Z]+)\/?([0-9a-z]*)#file-(.+)-L(\d+)-?L?(\d*)/i);
  if (gistMatch) handleMatch(msg, gistMatch, "Gist");

  let command = "INVALID-COMMAND";
  if (msg.content.trim().startsWith(`<@!${bot.user.id}>`)) {
    command = msg.content.substring(`<@!${bot.user.id}>`.length).trim();
  } else if (msg.content.trim().startsWith(PREFIX)) {
    command = msg.content.substring(PREFIX.length).trim();
  }

  if (Object.keys(COMMANDS).includes(command)) {
    COMMANDS[command](msg);
  }
});

bot.on("guildCreate", (guild) => {
  const joinEmbed = new DiscordBot.MessageEmbed()
    .setTitle("Thanks for adding me to your server! :heart:")
    .setDescription(
      "GitHub Lines runs automatically, without need for commands or configuration! " +
      "Just send a GitHub (or GitLab) link that mentions one or more lines and the bot will automatically respond.\n\n" +
      "There are a few commands you can use, although they are not necessary for the bot to work. To get a list, type `;help`\n\n" +
      "If you want to support us, just convince your friends to add the bot to their server!\n\n" +
      "Have fun!"
    );

  if (guild.systemChannel) {
    guild.systemChannel.send(joinEmbed);
    return;
  }

  let channel;
  guild.channels.cache.forEach((c) => {
    if (c[1].type === "text") {
      [channel] = c;
      return null;
    }
    return null;
  });
  channel.send(joinEmbed);
});

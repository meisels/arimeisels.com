import { AudioPlayerStatus, createAudioResource, createAudioPlayer, joinVoiceChannel, NoSubscriberBehavior } from "@discordjs/voice";
import mysql from "mysql";
import urlexists from "url-exists";
import util from "util";
import ytdl from "ytdl-core";
import ytpl from "ytpl";
import ytsr from "ytsr";

var urlExists = util.promisify(urlexists).bind(urlexists);

var mysqlLogin = JSON.parse(process.env.MYSQL);
mysqlLogin = Object.assign(mysqlLogin, { database: "yt" });
var database = mysql.createPool(mysqlLogin);
var query = util.promisify(database.query).bind(database);

const yt = { dl: ytdl, pl: ytpl, sr: ytsr };

async function getVideoDetails(id, cookie) {
    const db = (await query("SELECT * FROM `videos` WHERE id=?", [id]))[0];
    if (db && db.timestamp + 21600 >= Math.round(new Date().getTime() / 1000)) {
        return { success: true, formats: JSON.parse(decodeURIComponent(db.formats)), author: decodeURIComponent(db.author), title: decodeURIComponent(db.title), description: decodeURIComponent(db.description), thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
    }

    var videoInfo;
    if (cookie) {
        try {
            videoInfo = await yt.dl.getInfo(id, { requestOptions: { headers: { cookie } } });
        } catch (e) {
            return { success: false, message: "invalid_cookie", code: 403 };
        }
    } else {
        try {
            videoInfo = await yt.dl.getInfo(id);
        } catch (e) {
            if (e.statusCode == 410) return { success: false, message: "cookies_required", code: 410 };
            return { success: false, e };
        }
    }
    
    var hd;
    try { hd = videoInfo.formats.find(x => x.itag == 22).url; } catch (e) {}
    var sd = videoInfo.formats.find(x => x.itag == 18).url;
    var audio = videoInfo.formats.find(x => x.itag == 140).url;
    var formats = { hd, sd, audio };
    
    if ((await query("SELECT * FROM `videos` WHERE video=?", [id]))[0]) {
        if (!videoInfo.videoDetails.isPrivate) await query("UPDATE `videos` SET author=?, title=?, description=?, formats=? WHERE video=?", [encodeURIComponent(videoInfo.videoDetails.author.name), encodeURIComponent(videoInfo.videoDetails.title), encodeURIComponent(videoInfo.videoDetails.description), JSON.stringify(formats), id]);
    } else {
        await query("ALTER TABLE `videos` AUTO_INCREMENT=?", [(await query("SELECT MAX(`id`) AS max FROM `videos`"))[0].max]);
        if (!videoInfo.videoDetails.isPrivate) await query("INSERT INTO `videos`(`video`, `author`, `title`, `description`, `formats`) VALUES (?,?,?,?,?)", [id, encodeURIComponent(videoInfo.videoDetails.author.name), encodeURIComponent(videoInfo.videoDetails.title), encodeURIComponent(videoInfo.videoDetails.description) || "", JSON.stringify(formats)])
    }

    return { success: true, formats: formats, info: { author: videoInfo.videoDetails.author.name, title: videoInfo.videoDetails.title, description: videoInfo.videoDetails.description, thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } };
}

function getId(url) {
    var regExp = /^.*music.youtube.com\/watch?\??v?=?([^#&?]*).*/;
    var match = url.match(regExp);
    return (match && match[1].length == 11) ? match[1] : false;
}

export default async function (client, interaction, options) {
    await interaction.deferReply({ ephemeral: true });

    var id = getId(options.find(x => x.name == "song").value);
    if (!(await urlExists(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${id}`))) return await interaction.editReply("The song submitted does not exist.");
    
    const channel = client.channels.cache.get(options.find(x => x.name == "channel").value);
    if (channel.type != "GUILD_VOICE") return await interaction.editReply("The channel provided is not a voice channel.");

    const videoInfo = await getVideoDetails(id);

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();

    const subscription = await connection.subscribe(player);
    player.play(createAudioResource(videoInfo.formats.audio));

    await interaction.editReply(`Playing "${videoInfo.info.title}" in :loud_sound: ${channel.name}`);

    player.on(AudioPlayerStatus.Idle, () => {
        player.stop();
        subscription.unsubscribe();
        connection.destroy();
    });
}
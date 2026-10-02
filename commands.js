 // commands.js
const {
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

const { Guild } = require('./database.js');

// ----------------------------------------------------
// PARSE DURATION
// ----------------------------------------------------
function parseDuration(timeStr) {
    if (!timeStr) return null;

    const match = timeStr.match(/^(\d+)([smhdw])$/i);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const unitsInMs = {
        s: 1000,
        m: 1000 * 60,
        h: 1000 * 60 * 60,
        d: 1000 * 60 * 60 * 24,
        w: 1000 * 60 * 60 * 24 * 7
    };

    return value * unitsInMs[unit];
}

// ----------------------------------------------------
// RESOLVE USER + MEMBER
// ----------------------------------------------------
async function resolveUserAndMember(message, arg) {
    if (!arg) {
        return {
            user: null,
            member: null
        };
    }

    // Clean mention string to pure ID
    const cleanId = arg.replace(/[<@!>]/g, '');

    // Try fetching member by ID
    try {
        const member = await message.guild.members
            .fetch(cleanId)
            .catch(() => null);

        if (member) {
            return {
                user: member.user,
                member
            };
        }

        // Try fetching user globally
        const user = await message.client.users
            .fetch(cleanId)
            .catch(() => null);

        if (user) {
            return {
                user,
                member: null
            };
        }
    } catch (err) {}

    // Fallback: search username
    const fetchedMembers = await message.guild.members
        .fetch({
            query: arg,
            limit: 1
        })
        .catch(() => null);

    if (fetchedMembers && fetchedMembers.size > 0) {
        const member = fetchedMembers.first();

        return {
            user: member.user,
            member
        };
    }

    return {
        user: null,
        member: null
    };
}

// ----------------------------------------------------
// RESOLVE CHANNEL
// ----------------------------------------------------
async function resolveChannel(message, arg) {
    if (!arg) return null;

    const cleanId = arg.replace(/[<#>]/g, '');

    return message.guild.channels.cache.get(cleanId) || null;
}

// ----------------------------------------------------
// MESSAGE HANDLER
// ----------------------------------------------------
function handleMessages(client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Fetch prefix from database
        let guildData = await Guild.findOne({
            guildId: message.guild.id
        });

        // Default prefix is $
        let prefix = guildData ? guildData.prefix : '$';

        // Check prefix
        if (!message.content.startsWith(prefix)) return;

        const args = message.content
            .slice(prefix.length)
            .trim()
            .split(/ +/);

        const command = args.shift().toLowerCase();

        // ----------------------------------------------------
        // PREFIX COMMAND
        // ----------------------------------------------------
        if (command === 'prefix') {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return message.reply(
                    'You do not have Administrator permissions to change the prefix.'
                );
            }

            const newPrefix = args[0];

            if (!newPrefix) {
                return message.reply(
                    `Current prefix is \`${prefix}\`. Use \`${prefix}prefix <new_prefix>\` to modify it.`
                );
            }

            if (!guildData) {
                guildData = new Guild({
                    guildId: message.guild.id,
                    prefix: newPrefix
                });
            } else {
                guildData.prefix = newPrefix;
            }

            await guildData.save();

            return message.reply(
                `Prefix successfully updated to \`${newPrefix}\``
            );
        }
             // ----------------------------------------------------
   
        if (command === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor(0x00FFFF)
                .setTitle('🤖 Bot Commands List')
                .setDescription(`Current prefix is: **${prefix}**`)
                .addFields(
                    { name: '⚙️ Settings', value: '➔ `prefix [new_prefix]` ─ Change bot prefix' },
                    { name: '🛡️ Moderation', value: 
                        '➔ `kick [@user/ID/name]` ─ Kick a user\n' +
                        '➔ `ban [@user/ID/name]` ─ Ban a user\n' +
                        '➔ `unban [ID/name]` ─ Unban a user\n' +
                        '➔ `mute [@user/ID/name] [time]` `[timeout / to]` ─ Mute user (e.g., 2d, 1w)\n' +
                        '➔ `unmute [@user/ID/name]` `[removetimeout / rto]` ─ Unmute user'
                    },
                    { name: '🔒 Channels', value: 
                        '➔ `lock [#channel/ID]` ─ Lock a text channel\n' +
                        '➔ `unlock [#channel/ID]` ─ Unlock a text channel\n' +
                        '➔ `hide [#channel/ID]` ─ Hide a channel\n' +
                        '➔ `unhide [#channel/ID]` ─ Show a hidden channel\n' +
                        '➔ `cg [action] [categoryID]` ─ Lock/Unlock/Hide/Unhide a whole category' 
                    },
                    { name: '🏷️ Roles', value: 
                        '➔ `role [@role/roleID] [@user/ID/name]` ─ Give or remove a role\n' +
                        '➔ `mrole [@role/roleID] [@user1] [@user2]...` ─ Mass role users (max 30)\n' +
                        '➔ `giverole [roleID] [@role]` ─ **Tournament Version:** Reply to squad message'
                    }
                );

            return message.reply({ embeds: [helpEmbed] });
        }



        // ----------------------------------------------------
        // BAN COMMAND
        // ----------------------------------------------------
        if (command === 'ban') {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.BanMembers
                )
            ) {
                return;
            }

            const targetArg = args[0];

            const { user } = await resolveUserAndMember(
                message,
                targetArg
            );

            if (!user) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find **${targetArg || 'Unknown User'}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }

            try {
                await message.guild.members.ban(user.id);

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(
                        `Successfully Banned **${user.tag}** ✅`
                    );

                return message.reply({
                    embeds: [successEmbed]
                });
            } catch (err) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Ban **${user.tag}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }
        }

        // ----------------------------------------------------
        // UNBAN COMMAND
        // ----------------------------------------------------
        if (command === 'unban') {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.BanMembers
                )
            ) {
                return;
            }

            const targetId = args[0];

            if (!targetId) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find **Unknown User** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }

            try {
                const banList = await message.guild.bans.fetch();

                const bannedUser = banList.find(
                    (b) =>
                        b.user.id === targetId ||
                        b.user.username.toLowerCase() ===
                            targetId.toLowerCase()
                );

                if (!bannedUser) {
                    throw new Error('User not found in ban list');
                }

                await message.guild.members.unban(
                    bannedUser.user.id
                );

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(
                        `Successfully Unbanned **${bannedUser.user.tag}** ✅`
                    );

                return message.reply({
                    embeds: [successEmbed]
                });
            } catch (err) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find **${targetId}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }
        }

        // ----------------------------------------------------
        // KICK COMMAND
        // ----------------------------------------------------
        if (command === 'kick') {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.KickMembers
                )
            ) {
                return;
            }

            const targetArg = args[0];

            const { member } = await resolveUserAndMember(
                message,
                targetArg
            );

            if (!member) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find **${targetArg || 'Unknown User'}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }

            try {
                await member.kick();

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(
                        `Successfully Kicked **${member.user.tag}** ✅`
                    );

                return message.reply({
                    embeds: [successEmbed]
                });
            } catch (err) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Kick **${member.user.tag}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }
        }

        // ----------------------------------------------------
        // TIMEOUT / MUTE COMMAND
        // ----------------------------------------------------
        if (['to', 'timeout', 'mute'].includes(command)) {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {
                return;
            }

            const targetArg = args[0];
            const timeArg = args[1];

            const { member } = await resolveUserAndMember(
                message,
                targetArg
            );

            if (!member) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find **${targetArg || 'Unknown User'}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }

            if (!timeArg) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Please provide a time duration (e.g., 2d, 1w) ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }

            const durationMs = parseDuration(timeArg);

            const maxDurationMs =
                1000 * 60 * 60 * 24 * 28;

            if (!durationMs || durationMs > maxDurationMs) {
                const maxEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Can Only Mute for 28 Days ❌`
                    );

                return message.reply({
                    embeds: [maxEmbed]
                });
            }

            try {
                await member.timeout(durationMs);

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(
                        `Successfully Timed Out **${member.user.tag}** for **${timeArg}** ✅`
                    );

                return message.reply({
                    embeds: [successEmbed]
                });
            } catch (err) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Timeout **${member.user.tag}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }
        }

        // ----------------------------------------------------
        // REMOVE TIMEOUT / UNMUTE COMMAND
        // ----------------------------------------------------
        if (
            ['rto', 'removetimeout', 'unmute'].includes(command)
        ) {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {
                return;
            }

            const targetArg = args[0];

            const { member } = await resolveUserAndMember(
                message,
                targetArg
            );

            if (!member) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find **${targetArg || 'Unknown User'}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }

            try {
                await member.timeout(null);

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(
                        `Successfully Unmuted **${member.user.tag}** ✅`
                    );

                return message.reply({
                    embeds: [successEmbed]
                });
            } catch (err) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find **${member.user.tag}** ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }
        }

        // ----------------------------------------------------
        // CHANNELS
        // LOCK / UNLOCK / HIDE / UNHIDE
        // ----------------------------------------------------
        if (
            ['lock', 'unlock', 'hide', 'unhide'].includes(command)
        ) {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                return;
            }

            const targetChannel =
                (await resolveChannel(message, args[0])) ||
                message.channel;

            try {
                let options = {};

                const everyoneRole =
                    message.guild.roles.everyone;

                if (command === 'lock') {
                    options.SendMessages = false;
                }

                if (command === 'unlock') {
                    options.SendMessages = null;
                }

                if (command === 'hide') {
                    options.ViewChannel = false;
                }

                if (command === 'unhide') {
                    options.ViewChannel = null;
                }

                await targetChannel.permissionOverwrites.edit(
                    everyoneRole,
                    options
                );

                const actionStrings = {
                lock: 'Locked',
                unlock: 'Unlocked',
                hide: 'Hid',
                unhide: 'Unhid'
                };

                const actionString = actionStrings[command];
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(
                        `Successfully ${actionString} <#${targetChannel.id}> ✅`
                    );

                return message.reply({
                    embeds: [successEmbed]
                });
            } catch (err) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find The Channel ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }
        }

        // ----------------------------------------------------
        // CATEGORY COMMANDS
        // $cg lock/unlock/hide/unhide <categoryID>
        // ----------------------------------------------------
        if (command === 'cg') {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                return;
            }

            const action = args[0]?.toLowerCase();
            const categoryId = args[1];

            if (
                !['lock', 'unlock', 'hide', 'unhide'].includes(
                    action
                ) ||
                !categoryId
            ) {
                return message.reply(
                    `Usage: ${prefix}cg <lock/unlock/hide/unhide> <categoryID>`
                );
            }

            const cleanCategoryId = categoryId.replace(
                /[<#>]/g,
                ''
            );

            const category =
                message.guild.channels.cache.get(
                    cleanCategoryId
                );

            if (
                !category ||
                category.type !== ChannelType.GuildCategory
            ) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Find The Category ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }

            try {
                const childrenChannels =
                    message.guild.channels.cache.filter(
                        (c) => c.parentId === category.id
                    );

                const everyoneRole =
                    message.guild.roles.everyone;

                let options = {};

                if (action === 'lock') {
                    options.SendMessages = false;
                }

                if (action === 'unlock') {
                    options.SendMessages = null;
                }

                if (action === 'hide') {
                    options.ViewChannel = false;
                }

                if (action === 'unhide') {
                    options.ViewChannel = null;
                }

                for (const [, childChan] of childrenChannels) {
                    await childChan.permissionOverwrites.edit(
                        everyoneRole,
                        options
                    );
                }

                const actionStrings = {
                    lock: 'Locked',
                    unlock: 'Unlocked',
                    hide: 'Hid',
                    unhide: 'Unhid'
                };

                const actionString = actionStrings[action];;

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(
                        `Successfully ${actionString} **${childrenChannels.size}** Channels From **${category.name}** ✅`
                    );

                return message.reply({
                    embeds: [successEmbed]
                });
            } catch (err) {
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(
                        `Could Not Update The Category ❌`
                    );

                return message.reply({
                    embeds: [failEmbed]
                });
            }
        }

        // ----------------------------------------------------
        // ROLE SINGLE / TOGGLE
        // \$role <role> <user> (Removed the "add" keyword requirement)
        // ----------------------------------------------------
        if (command === 'role') {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {
                return;
            }

            // shift the arguments left since we removed "add"
            const roleArg = args[0];
            const userArg = args[1];

            if (!roleArg || !userArg) {
                return message.reply(
                    `Usage: ${prefix}role <@role/roleID> <@user/userID/username>`
                );
            }

            const cleanRoleId = roleArg.replace(
                /[<@&>]/g,
                ''
            );

            const targetRole =
                message.guild.roles.cache.get(cleanRoleId);

            const { member } = await resolveUserAndMember(
                message,
                userArg
            );

            if (!targetRole || !member) {
                return message.reply(
                    'Could not resolve the specified role or target user. Please make sure IDs/mentions are valid.'
                );
            }

            try {
                // Toggle role
                if (member.roles.cache.has(targetRole.id)) {
                    await member.roles.remove(targetRole.id);

                    const successEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setDescription(
                            `Successfully Removed **${targetRole.name}** From **${member.user.username}** ✅`
                        );

                    return message.reply({
                        embeds: [successEmbed]
                    });
                } else {
                    await member.roles.add(targetRole.id);

                    const successEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setDescription(
                            `Successfully Gave **${targetRole.name}** To **${member.user.username}** ✅`
                        );

                    return message.reply({
                        embeds: [successEmbed]
                    });
                }
            } catch (err) {
                return message.reply(
                    'Failed to update roles. Ensure my bot role is higher than the target role.'
                );
            }

            // Ensures execution stops here completely
            return; 
        }


        // ----------------------------------------------------
        // MULTI-ROLE COMMAND
        // $mrole <role1> <role2> ... <user>
        // ----------------------------------------------------
// ----------------------------------------------------
// MULTI-USER ROLE COMMAND
// $mrole <@role/roleID> <@user1/userID1/username1> <@user2/userID2/username2> ...
// Maximum 30 users
// ----------------------------------------------------
if (command === 'mrole') {
    if (
        !message.member.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {
        return;
    }

    const roleArg = args[0];
    const userArgs = args.slice(1);

    // Check role
    if (!roleArg) {
        return message.reply(
            `Usage: ${prefix}mrole <@role/roleID> <@user1/userID1/username1> <@user2/userID2/username2> ...`
        );
    }

    // Check users
    if (userArgs.length === 0) {
        return message.reply(
            `Usage: ${prefix}mrole <@role/roleID> <@user1/userID1/username1> <@user2/userID2/username2> ...`
        );
    }

    // Maximum 30 users
    if (userArgs.length > 30) {
        return message.reply(
            'You can select a maximum of 30 users at once.'
        );
    }

    // Resolve role
    const cleanRoleId = roleArg.replace(
        /[<@&>]/g,
        ''
    );

    const targetRole =
        message.guild.roles.cache.get(cleanRoleId);

    if (!targetRole) {
        return message.reply(
            'Could not find the specified role. Please make sure the role ID or mention is valid.'
        );
    }

    let successCount = 0;
    let failedCount = 0;

    try {
        // Process every user
        for (const userArg of userArgs) {
            const { member } =
                await resolveUserAndMember(
                    message,
                    userArg
                );

            if (!member) {
                failedCount++;
                continue;
            }

            // Give role only if they don't already have it
            if (!member.roles.cache.has(targetRole.id)) {
                await member.roles.add(targetRole.id);
            }

            successCount++;
        }

        const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setDescription(
                `Successfully Gave **${targetRole.name}** To **${successCount}** Users ✅`
            );

        if (failedCount > 0) {
            successEmbed.addFields({
                name: 'Could Not Find',
                value: `**${failedCount}** user(s)`,
                inline: true
            });
        }

        return message.reply({
            embeds: [successEmbed]
        });

    } catch (err) {
        console.error('Multi-role error:', err);

        return message.reply(
            'Failed while applying the role. Ensure my bot role is higher than the target role.'
                );
            }
        }
        // ----------------------------------------------------
        // ----------------------------------------------------
        // GIVE ROLE FROM TOURNAMENT SQUAD MESSAGE
        // \$giverole <roleID>
        // Must be used while replying to a tournament squad message
        // ----------------------------------------------------
        if (command === 'giverole') {
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {
                return;
            }

            const roleId = args[0];

            // Check role ID
            if (!roleId) {
                return message.reply(
                    `Usage: ${prefix}giverole <roleID>`
                );
            }

            // Get role from ID first
            const targetRole =
                message.guild.roles.cache.get(roleId);

            if (!targetRole) {
                return message.reply(
                    'Could not find the specified role ID.'
                );
            }

            // Make sure command is replying to a message
            if (!message.reference?.messageId) {
                return message.reply(
                    `Please use ${prefix}giverole as a reply to the tournament squad message.`
                );
            }

            // Fetch the replied message
            let repliedMessage;

            try {
                repliedMessage = await message.channel.messages.fetch(
                    message.reference.messageId
                );
            } catch (err) {
                return message.reply(
                    'Could not fetch the tournament squad message.'
                );
            }

            if (!repliedMessage) {
                return message.reply(
                    'Could not find the tournament squad message.'
                );
            }

            // ------------------------------------------------
            // PARSE TOURNAMENT SQUAD
            // Example:
            // .shrek69 (766324039282196500)
            // 8rayx (617041714982856704)
            // ------------------------------------------------

            const lines = repliedMessage.content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (lines.length === 0) {
                return message.reply(
                    'The replied message does not contain any users.'
                );
            }

            const users = [];

            for (const line of lines) {
                // Extract username + ID
                const match = line.match(
                    /^(.+?)\s*\((\d{17,20})\)\s*\$/
                );

                if (!match) {
                    continue;
                }

                const username = match[1].trim();
                const userId = match[2].trim();

                users.push({
                    username,
                    userId
                });
            }

            if (users.length === 0) {
                return message.reply(
                    'Could not detect any tournament-style users in the replied message.'
                );
            }

            // ------------------------------------------------
            // TRACKING CATEGORIES
            // ------------------------------------------------
            const givenTo = [];
            const alreadyHad = [];
            const notInServer = [];

            for (const squadUser of users) {
                let member = null;

                // FIRST TRY USERNAME
                try {
                    const foundMembers =
                        await message.guild.members.fetch({
                            query: squadUser.username,
                            limit: 1
                        });

                    if (
                        foundMembers &&
                        foundMembers.size > 0
                    ) {
                        const exactMatch =
                            foundMembers.find(
                                m =>
                                    m.user.username.toLowerCase() ===
                                    squadUser.username.toLowerCase()
                            );

                        member = exactMatch || foundMembers.first();
                    }
                } catch (err) {}

                // IF USERNAME FAILED, TRY ID
                if (!member) {
                    try {
                        member =
                            await message.guild.members
                                .fetch(squadUser.userId)
                                .catch(() => null);
                    } catch (err) {
                        member = null;
                    }
                }

                // BOTH FAILED: NOT IN SERVER
                if (!member) {
                    notInServer.push(`\`\${squadUser.username}\` (${squadUser.userId})`);
                    continue;
                }

                // CHECK AND APPLY ROLE
                try {
                    if (member.roles.cache.has(targetRole.id)) {
                        alreadyHad.push(`${member.user.toString()}`);
                    } else {
                        await member.roles.add(targetRole.id);
                        givenTo.push(`${member.user.toString()}`);
                    }
                } catch (err) {
                    console.error(
                        `Failed to process role for ${member.user.tag}:`,
                        err
                    );
                    notInServer.push(`\`\${squadUser.username}\` (Hierarchy Error)`);
                }
            }

            // ------------------------------------------------
            // RENDER EMBED RESULT
            // ------------------------------------------------
            const resultEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`🏆 Tournament Squad Role Update`)
                .setDescription(`Processed role updates for **${targetRole.name}**`)
                .setTimestamp();

            // 1. Members given to
            resultEmbed.addFields({
                name: `✅ Members Given To (${givenTo.length})`,
                value: givenTo.length > 0 ? givenTo.join(', ') : '*None*',
                inline: false
            });

            // 2. Members who already had it
            resultEmbed.addFields({
                name: `👥 Already Had Role (${alreadyHad.length})`,
                value: alreadyHad.length > 0 ? alreadyHad.join(', ') : '*None*',
                inline: false
            });

            // 3. Members not found / not in server
            resultEmbed.addFields({
                name: `❌ Not In Server (${notInServer.length})`,
                value: notInServer.length > 0 ? notInServer.join('\n') : '*None*',
                inline: false
            });

            return message.reply({
                embeds: [resultEmbed]
            });
        }
    });
}


module.exports = {
    handleMessages
};

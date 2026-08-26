/*
 * SoulFire
 * Copyright (C) 2026  AlexProgrammerDE
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package com.soulfiremc.server.plugins;

import com.soulfiremc.server.api.InternalPlugin;
import com.soulfiremc.server.api.InternalPluginClass;
import com.soulfiremc.server.api.PluginInfo;
import com.soulfiremc.server.api.event.bot.ChatMessageReceiveEvent;
import com.soulfiremc.server.api.event.lifecycle.InstanceSettingsRegistryInitEvent;
import com.soulfiremc.server.settings.lib.SettingsObject;
import com.soulfiremc.server.settings.lib.SettingsSource;
import com.soulfiremc.server.settings.property.*;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.lenni0451.lambdaevents.EventHandler;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Slf4j
@InternalPluginClass
public final class AutoTpAccept extends InternalPlugin {
  /// Compiled patterns, keyed by the configured pattern string.
  ///
  /// The handler runs for every chat line every bot receives, so compiling on
  /// each message would burn CPU proportional to chat volume. The key is the
  /// setting's value rather than the bot, so changing the setting takes effect
  /// without a restart and does not leak an entry per bot.
  private static final Map<String, Pattern> PATTERN_CACHE = new ConcurrentHashMap<>();

  /// Patterns that failed to compile, so a broken setting is logged once per
  /// value rather than once per chat message.
  private static final Map<String, Boolean> WARNED_PATTERNS = new ConcurrentHashMap<>();

  public AutoTpAccept() {
    super(new PluginInfo(
      "auto-tp-accept",
      "1.0.0",
      "Automatically accepts teleport requests from allowed players",
      "AlexProgrammerDE",
      "AGPL-3.0",
      "https://soulfiremc.com"
    ));
  }

  @EventHandler
  public static void onChat(ChatMessageReceiveEvent event) {
    var connection = event.connection();
    var settingsSource = connection.settingsSource();
    if (!settingsSource.get(AutoTpAcceptSettings.ENABLED)) {
      return;
    }

    var allowedPlayers = settingsSource.get(AutoTpAcceptSettings.ALLOWED_PLAYERS);
    if (allowedPlayers.isEmpty()) {
      // An empty allowlist means "accept from nobody". Accepting from everyone
      // would let any player on the server teleport to the bot on demand, which
      // is not a default anyone would want silently applied.
      return;
    }

    var pattern = compilePattern(settingsSource.get(AutoTpAcceptSettings.REQUEST_PATTERN));
    if (pattern == null) {
      return;
    }

    var matcher = pattern.matcher(event.parseToPlainText());
    if (!matcher.find() || matcher.groupCount() < 1) {
      return;
    }

    var requester = matcher.group(1);
    if (requester == null || requester.isEmpty()) {
      return;
    }

    // Minecraft names are ASCII, so the root locale avoids the Turkish dotted-I
    // problem turning "I" into a character that no longer matches.
    var requesterKey = requester.toLowerCase(Locale.ROOT);
    var allowed = allowedPlayers.stream()
      .map(name -> name.trim().toLowerCase(Locale.ROOT))
      .anyMatch(requesterKey::equals);
    if (!allowed) {
      return;
    }

    var command = settingsSource.get(AutoTpAcceptSettings.ACCEPT_COMMAND)
      .replace("%player%", requester);

    // Delayed, like AutoRegister: replying to a teleport request in the same
    // tick it arrives is a reliable bot tell, and some servers rate-limit
    // commands sent that fast.
    connection.scheduler().schedule(
      () -> connection.sendChatMessage(command),
      settingsSource.getRandom(AutoTpAcceptSettings.DELAY).getAsInt(),
      TimeUnit.MILLISECONDS);
  }

  /// Returns null when the configured pattern does not compile.
  private static Pattern compilePattern(String patternString) {
    if (patternString.isBlank()) {
      return null;
    }

    var cached = PATTERN_CACHE.get(patternString);
    if (cached != null) {
      return cached;
    }

    try {
      var compiled = Pattern.compile(patternString, Pattern.CASE_INSENSITIVE);
      PATTERN_CACHE.put(patternString, compiled);
      return compiled;
    } catch (PatternSyntaxException e) {
      if (WARNED_PATTERNS.putIfAbsent(patternString, Boolean.TRUE) == null) {
        log.warn("Auto TP Accept: request pattern does not compile, ignoring it: {}", e.getMessage());
      }
      return null;
    }
  }

  @EventHandler
  public void onSettingsRegistryInit(InstanceSettingsRegistryInitEvent event) {
    event.settingsPageRegistry().addPluginPage(AutoTpAcceptSettings.class, "auto-tp-accept", "Auto TP Accept", this, "user-check", AutoTpAcceptSettings.ENABLED);
  }

  @NoArgsConstructor(access = AccessLevel.NONE)
  private static class AutoTpAcceptSettings implements SettingsObject {
    private static final String NAMESPACE = "auto-tp-accept";
    public static final BooleanProperty<SettingsSource.Bot> ENABLED =
      ImmutableBooleanProperty.<SettingsSource.Bot>builder()
        .sourceType(SettingsSource.Bot.INSTANCE)
        .namespace(NAMESPACE)
        .key("enabled")
        .uiName("Enable Auto TP Accept")
        .description("Accept teleport requests from allowed players automatically")
        .defaultValue(false)
        .build();
    public static final StringListProperty<SettingsSource.Bot> ALLOWED_PLAYERS =
      ImmutableStringListProperty.<SettingsSource.Bot>builder()
        .sourceType(SettingsSource.Bot.INSTANCE)
        .namespace(NAMESPACE)
        .key("allowed-players")
        .uiName("Allowed Players")
        .description("Only accept teleport requests from these players. Case-insensitive. Empty means accept from nobody.")
        .addAllDefaultValue(List.of())
        .build();
    public static final StringProperty<SettingsSource.Bot> REQUEST_PATTERN =
      ImmutableStringProperty.<SettingsSource.Bot>builder()
        .sourceType(SettingsSource.Bot.INSTANCE)
        .namespace(NAMESPACE)
        .key("request-pattern")
        .uiName("Request Pattern")
        .description("Regex matching a teleport request. Capture group 1 must be the requesting player's name. Matched case-insensitively.")
        .defaultValue("(?:^|\\s)([A-Za-z0-9_]{3,16})\\s+(?:has requested to teleport to you|has requested that you teleport to (?:them|him|her)|sent you a (?:teleport|tpa) request|wants to teleport to you|is requesting to teleport to you)")
        .build();
    public static final StringProperty<SettingsSource.Bot> ACCEPT_COMMAND =
      ImmutableStringProperty.<SettingsSource.Bot>builder()
        .sourceType(SettingsSource.Bot.INSTANCE)
        .namespace(NAMESPACE)
        .key("accept-command")
        .uiName("Accept Command")
        .description("Command to run to accept. %player% is replaced with the requesting player's name.")
        .defaultValue("/tpaccept %player%")
        .build();
    public static final MinMaxProperty<SettingsSource.Bot> DELAY =
      ImmutableMinMaxProperty.<SettingsSource.Bot>builder()
        .sourceType(SettingsSource.Bot.INSTANCE)
        .namespace(NAMESPACE)
        .key("delay")
        .minValue(0)
        .maxValue(Integer.MAX_VALUE)
        .minEntry(ImmutableMinMaxPropertyEntry.builder()
          .uiName("Min delay (ms)")
          .description("Minimum delay before accepting a teleport request")
          .defaultValue(500)
          .build())
        .maxEntry(ImmutableMinMaxPropertyEntry.builder()
          .uiName("Max delay (ms)")
          .description("Maximum delay before accepting a teleport request")
          .defaultValue(1500)
          .build())
        .build();
  }
}

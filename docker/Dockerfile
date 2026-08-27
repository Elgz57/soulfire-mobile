# SoulFire with the plugins from ../server-plugin baked in.
#
# Based on the image the server already runs rather than rebuilt from a JRE
# base, so the user, entrypoint, start.sh, healthcheck and JVM flags stay
# byte-identical to upstream and the only difference is the jar. That keeps this
# working if upstream changes how the image is put together.
ARG BASE_IMAGE=alexprogrammerde/soulfire:latest
FROM ${BASE_IMAGE}

ARG SF_VERSION=2.9.1

# --chmod/--chown avoids switching to root, so the image ends up with the same
# effective user as the base.
COPY --chown=soulfire:soulfire --chmod=644 out/SoulFireDedicated-${SF_VERSION}.jar /soulfire/soulfire.jar

LABEL org.opencontainers.image.description="SoulFire ${SF_VERSION} with custom plugins (Auto TP Accept)" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.title="SoulFire (custom plugins)"

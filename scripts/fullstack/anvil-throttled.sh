#!/bin/sh
# Mounted as `anvil` ahead of the real binary on the e2e Anvil container's PATH
# (docker-compose.fullstack.override.yml), so aphelion-app's entrypoint script runs unchanged but
# a forking anvil throttles its upstream requests:
#   --compute-units-per-second  stay under the Alchemy plan's throughput instead of hitting 429s
#                               (anvil assumes 330, a paid plan); excess requests queue in anvil
#   --retries / --fork-retry-backoff  ride out the occasional 429 instead of failing the read
# anvil only accepts these flags together with --fork-url, so a non-forking anvil is left as is.
case " $* " in
  *" --fork-url "* | *" -f "*)
    exec /usr/local/bin/anvil "$@" \
      --compute-units-per-second "${FULLSTACK_ANVIL_CUPS:-100}" \
      --retries 10 \
      --fork-retry-backoff 1000
    ;;
esac
exec /usr/local/bin/anvil "$@"

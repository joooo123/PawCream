import { useEffect } from 'react'
import AtelierWithCollection from './AtelierWithCollection'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

const BASE_URL = import.meta.env.BASE_URL
const HOUSE_NOTEBOOK = `${BASE_URL}assets/collection/${encodeURIComponent('房子笔记本.png')}`

export default function AtelierWithHouseCollection(props: Props) {
  useEffect(() => {
    const image = new Image()
    image.decoding = 'async'
    image.src = HOUSE_NOTEBOOK
  }, [])

  return (
    <>
      <style>{`
        /*
         * House notebook shell.
         * The old Qingkong canvas stays 2:3 and unchanged inside this shell,
         * so all existing percentage-based slot positions keep their meaning.
         */
        .pawcream-lookbook-overlay {
          background: rgba(220, 238, 244, .58) !important;
          backdrop-filter: blur(12px) saturate(106%) !important;
          -webkit-backdrop-filter: blur(12px) saturate(106%) !important;
        }

        .pawcream-lookbook-stage {
          width: min(
            540px,
            calc((100vw - 28px) * .675),
            calc((100svh - 28px) * .535)
          ) !important;
          aspect-ratio: 2 / 3 !important;
          overflow: visible !important;
          isolation: isolate !important;
          filter: none !important;
        }

        .pawcream-lookbook-stage::before {
          content: '';
          position: absolute;
          left: 45.8%;
          top: 50%;
          z-index: 0;
          width: 147.7%;
          aspect-ratio: 561 / 701;
          transform: translate(-50%, -50%);
          background: url("${HOUSE_NOTEBOOK}") center / contain no-repeat;
          filter: drop-shadow(0 24px 34px rgba(67, 102, 114, .20));
          pointer-events: none;
          user-select: none;
        }

        .pawcream-lookbook-base {
          z-index: 1;
          border-radius: 10px;
          filter: drop-shadow(0 2px 5px rgba(79, 111, 118, .05));
        }

        .pawcream-lookbook-slot {
          z-index: 2;
        }

        .pawcream-lookbook-slot.is-tuning.is-selected {
          z-index: 11;
        }

        .pawcream-lookbook-close,
        .pawcream-lookbook-arrow {
          z-index: 20 !important;
        }

        .pawcream-lookbook-close {
          top: -8% !important;
          right: -25% !important;
        }

        .pawcream-lookbook-counter {
          display: none !important;
        }

        @media (max-width: 700px) {
          .pawcream-lookbook-overlay {
            padding: 8px !important;
          }

          .pawcream-lookbook-stage {
            width: min(
              calc((100vw - 18px) * .675),
              calc((100svh - 18px) * .535)
            ) !important;
          }

          .pawcream-lookbook-close {
            top: -8% !important;
            right: -25% !important;
            width: 36px !important;
            height: 36px !important;
          }
        }
      `}</style>

      <AtelierWithCollection {...props} />
    </>
  )
}

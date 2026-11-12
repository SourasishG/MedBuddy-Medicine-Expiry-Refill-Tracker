import { ImageResponse } from 'next/og';

export const alt = 'MedBuddy — Every dose. Every expiry. Every loved one.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background:
          'radial-gradient(circle at 68% 35%, rgba(27, 46, 89, 0.72), rgba(9, 12, 18, 1) 62%)',
        backgroundColor: '#090C12',
        color: '#EAF0F6',
        fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '20px',
            letterSpacing: '0.22em',
            fontFamily: 'monospace',
            color: '#EAF0F6',
          }}
        >
          MEDBUDDY
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 18px',
            borderRadius: '999px',
            border: '1px solid rgba(92, 242, 199, 0.35)',
            backgroundColor: 'rgba(92, 242, 199, 0.1)',
            color: '#5CF2C7',
            fontSize: '15px',
            fontFamily: 'monospace',
          }}
        >
          EXPIRY · DOSE · FAMILY ADHERENCE
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '880px' }}>
        <div
          style={{
            fontSize: '74px',
            lineHeight: 1.04,
            letterSpacing: '-0.02em',
            color: '#EAF0F6',
          }}
        >
          Every dose. Every expiry. Every loved one.
        </div>
        <div
          style={{
            fontSize: '25px',
            lineHeight: 1.45,
            color: '#9BA7BA',
            fontFamily: 'sans-serif',
          }}
        >
          Track medicine shelf-life, opened-bottle countdowns, dose reminders, and refills across
          your home cabinet.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'monospace' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderRadius: '999px',
            border: '1px solid rgba(92, 242, 199, 0.35)',
            color: '#5CF2C7',
            fontSize: '16px',
          }}
        >
          In date
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderRadius: '999px',
            border: '1px solid rgba(255, 195, 92, 0.35)',
            color: '#FFC35C',
            fontSize: '16px',
          }}
        >
          Use soon
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderRadius: '999px',
            border: '1px solid rgba(255, 92, 119, 0.35)',
            color: '#FF5C77',
            fontSize: '16px',
          }}
        >
          Expired
        </div>
      </div>
    </div>,
    size,
  );
}

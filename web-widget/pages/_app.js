import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <div className="bg-noise min-h-screen">
      <Component {...pageProps} />
    </div>
  );
}

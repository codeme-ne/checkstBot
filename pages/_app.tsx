import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { ToastContainer } from '../components/Toast';
import ErrorBoundary from '../components/ErrorBoundary';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <Component {...pageProps} />
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default MyApp;

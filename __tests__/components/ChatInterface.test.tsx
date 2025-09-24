import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatInterface from '../../components/ChatInterface';

describe('ChatInterface', () => {
  it('renders chat interface with input and send button', () => {
    render(<ChatInterface documentId="test-doc" />);

    expect(screen.getByPlaceholderText(/Stellen Sie Ihre Frage/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('displays initial assistant message', () => {
    render(<ChatInterface documentId="test-doc" />);

    expect(screen.getByText(/Hallo! Ich bin Ihr intelligenter Lernassistent/i)).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<ChatInterface documentId="test-doc" />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has text', () => {
    render(<ChatInterface documentId="test-doc" />);

    const input = screen.getByPlaceholderText(/Stellen Sie Ihre Frage/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'Test question' } });
    expect(sendButton).not.toBeDisabled();
  });

  it('clears input after sending message', () => {
    render(<ChatInterface documentId="test-doc" />);

    const input = screen.getByPlaceholderText(/Stellen Sie Ihre Frage/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(input.value).toBe('');
  });

  it('sends message on Enter key press', () => {
    render(<ChatInterface documentId="test-doc" />);

    const input = screen.getByPlaceholderText(/Stellen Sie Ihre Frage/i);

    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(screen.getByText('Test question')).toBeInTheDocument();
  });
});
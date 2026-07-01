import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

interface NavigationIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

const NavigationIcon: React.FC<NavigationIconProps> = ({ name, size = 24, color = '#1E1B4B', style }) => {
  let path = '';
  const viewBox = '0 0 24 24';

  switch (name) {
    case 'menu':
      // 3-line hamburger menu
      path = 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z';
      break;
    case 'heart':
      // Filled heart
      path = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
      break;
    case 'heart-outline':
      // Outlined heart
      path = 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z';
      break;
    case 'arrow-forward':
    case 'arrow-forward-sharp':
      // Back/Forward navigation arrow pointing forward (RTL layout)
      path = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';
      break;
    case 'chevron-back':
      // chevron back arrow
      path = 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z';
      break;
    case 'chevron-forward':
      // chevron forward arrow
      path = 'M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z';
      break;
    case 'chevron-down':
      // chevron down arrow
      path = 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z';
      break;
    case 'checkbox':
      // Checked square
      path = 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
      break;
    case 'square-outline':
      // Outlined square
      path = 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z';
      break;
    case 'close':
      // close/x button
      path = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
      break;
    case 'close-circle':
      // close circle button
      path = 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z';
      break;
    case 'log-out':
    case 'log-out-outline':
    case 'exit':
      // exit door sign out
      path = 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z';
      break;
    case 'help-circle-outline':
      path = 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z';
      break;
    case 'people-outline':
    case 'people-sharp':
      path = 'M16.5 13c-1.2 0-3.07.34-3.74 1-1.22-.37-2.91-.6-3.76-.6-2.67 0-8 1.34-8 4v3h15v-3c0-1-.34-2.31-1.26-3.74.6-.33 1.26-.66 1.76-.66z M9 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm7.5 0c1.38 0 2.5-1.12 2.5-2.5S17.88 6 16.5 6s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5z';
      break;
    case 'alert-circle-outline':
      path = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v6h2V7zm0 8h-2v2h2v-2z';
      break;
    case 'warning-outline':
      path = 'M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z';
      break;
    case 'calculator-outline':
      path = 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-2-4h-4v-2h4v2zm0-4h-4V9h4v2zm-6 4H7v-2h4v2zm0-4H7V9h4v2z';
      break;
    case 'refresh-outline':
      path = 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z';
      break;
    case 'logo-google':
      path = 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z';
      break;
    case 'logo-whatsapp':
      path = 'M12.012 2.25c-5.378 0-9.756 4.378-9.756 9.756 0 1.72.448 3.4 1.301 4.877l-1.385 5.06 5.176-1.358c1.42.775 3.016 1.185 4.661 1.187h.004c5.378 0 9.758-4.38 9.758-9.758 0-2.605-1.014-5.055-2.857-6.899-1.843-1.843-4.293-2.863-6.902-2.863zm5.727 13.067c-.244.689-1.43 1.309-1.959 1.393-.473.076-.948.147-3.048-.718-2.68-1.106-4.41-3.83-4.544-4.009-.134-.179-.982-1.305-.982-2.49 0-1.186.621-1.768.841-2.008.22-.24.478-.301.638-.301.16 0 .32 0 .459.006.143.006.335-.054.526.402.197.472.673 1.637.731 1.758.058.12.096.26.018.416-.078.156-.118.252-.236.39-.118.138-.25.309-.356.416-.119.12-.244.25-.104.49.14.238.621 1.021 1.332 1.654.916.816 1.692 1.069 1.93 1.189.238.12.378.1.518-.06.14-.16.598-.696.758-.936.16-.24.32-.2.538-.12.22.08 1.392.657 1.632.777.24.12.399.18.459.28.06.1.06.58-.184 1.269z';
      break;
    case 'add':
      path = 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z';
      break;
    case 'add-circle-outline':
      path = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z';
      break;
    case 'remove':
      path = 'M19 13H5v-2h14v2z';
      break;
    case 'print':
      path = 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z';
      break;
    case 'list-outline':
    case 'list-sharp':
      path = 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z';
      break;
    case 'arrow-back':
    case 'arrow-back-outline':
      path = 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z';
      break;
    case 'link-outline':
      path = 'M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z';
      break;
    case 'swap-horizontal':
      path = 'M16.01 11H4v2h12.01v3L20 12l-3.99-4v3zm-.02-7L12 8v3h8V8h-3.99V4z M8 16h12v-2H8v-3L4 15l4 4v-3z';
      break;
    case 'slot-machine':
      path = 'M5 12L7 8V7H4V8H6L4 12M9 12L11 8V7H8V8H10L8 12M13 12L15 8V7H12V8H14L12 12M21 2C19.9 2 19 2.9 19 4C19 4.7 19.4 5.4 20 5.7V17H17V15C17.6 15 18 14.6 18 14V5C18 4.4 17.6 4 17 4H13.2C12.4 2.8 11 2 9.5 2S6.6 2.8 5.8 4H2C1.4 4 1 4.4 1 5V14C1 14.6 1.4 15 2 15V22H17V19H20C21.1 19 22 18.1 22 17V5.7C22.6 5.4 23 4.7 23 4C23 2.9 22.1 2 21 2M13 19H6V17H13V19M16 13H3V6H16V13Z';
      break;
    case 'slot-machine-outline':
      path = 'M5 12L7 8V7H4V8H6L4 12M9 12L11 8V7H8V8H10L8 12M13 12L15 8V7H12V8H14L12 12M21 2C19.9 2 19 2.9 19 4C19 4.7 19.4 5.4 20 5.7V17H17V15C17.6 15 18 14.6 18 14V5C18 4.4 17.6 4 17 4H13.2C12.4 2.8 11 2 9.5 2S6.6 2.8 5.8 4H2C1.4 4 1 4.4 1 5V14C1 14.6 1.4 15 2 15V22H17V19H20C21.1 19 22 18.1 22 17V5.7C22.6 5.4 23 4.7 23 4C23 2.9 22.1 2 21 2M3 6H16V13H3V6M15 20H4V15H15V20M13 19H6V17H13V19Z';
      break;
    case 'gift':
      path = 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35-.54-.81-1.45-1.35-2.5-1.35-1.66 0-3 1.34-3 3 0 .35.07.69.18 1H5c-1.1 0-2 .9-2 2v3c0 .55.45 1 1 1h1v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V12h1c.55 0 1-.45 1-1V8c0-1.1-.9-2-2-2zM5 8h6v3H5V8zm2 5h4v8H7v-8zm10 8h-4v-8h4v8zm2-10h-6V8h6v3z';
      break;
    case 'gift-outline':
      path = 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35-.54-.81-1.45-1.35-2.5-1.35-1.66 0-3 1.34-3 3 0 .35.07.69.18 1H5c-1.1 0-2 .9-2 2v3c0 .55.45 1 1 1h1v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V12h1c.55 0 1-.45 1-1V8c0-1.1-.9-2-2-2zM15 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-6 1c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zM5 8h6v3H5V8zm2 5h4v8H7v-8zm10 8h-4v-8h4v8zm2-10h-6V8h6v3z';
      break;
    case 'female':
      path = 'M12 2c-3.87 0-7 3.13-7 7 0 3.47 2.52 6.34 5.83 6.91V18H9v2h1.83v2h2v-2H15v-2h-2.17v-2.09c3.31-.57 5.83-3.44 5.83-6.91 0-3.87-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z';
      break;
    case 'male':
      path = 'M20 2h-6v2h3.59L13 8.59c-3.15-2.24-7.46-1.72-10 1.25s-2.03 7.37.5 9.75 6.78 2.37 9.25-.25c2.45-2.6 2.75-6.66.75-9.59L18 5.41V9h2V2zM9 20c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z';
      break;
    case 'person-circle-outline':
      path = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z';
      break;
    case 'person-outline':
      path = 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';
      break;
    case 'person-add-outline':
      path = 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z M6 10v-3h2v3h3v2H8v3H6v-3H3v-2h3z';
      break;
    case 'lock-open-outline':
      path = 'M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v1.9H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6-5c1.66 0 3 1.34 3 3v2H9V6c0-1.66 1.34-3 3-3zm6 15H6V10h12v10z';
      break;
    case 'business-outline':
      path = 'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z';
      break;
    case 'videocam-outline':
      path = 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM15 16H5V8h10v8z';
      break;
    case 'star':
      path = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';
      break;
    case 'star-outline':
      path = 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.37L12 6.1l1.7 4.04 4.38.37-3.32 2.88 1 4.28L12 15.4z';
      break;
    case 'lock-closed':
      path = 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z';
      break;
    case 'pencil':
    case 'pencil-sharp':
    case 'create-outline':
      path = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
      break;
    case 'trash-outline':
      path = 'M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z';
      break;
    case 'repeat':
      path = 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z';
      break;
    case 'shuffle':
      path = 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.38 10.17l-1.42 1.41 3.17 3.17L14.5 20H20v-5.5l-2.04 2.04-3.08-3.07z';
      break;
    case 'grid':
      path = 'M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z';
      break;
    case 'log-in':
      path = 'M10.79 16.29l1.41 1.41 5-5-5-5-1.41 1.41 2.58 2.59H3v2h10.37l-2.58 2.59zM19 3H5c-1.1 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z';
      break;
    case 'eye-outline':
      path = 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z';
      break;
    case 'eye-off-outline':
      path = 'M12 6c3.79 0 7.17 2.13 8.82 5.5-.53 1.1-1.28 2.04-2.22 2.78l1.41 1.41C21.37 14.51 22.42 12.88 23 11.5c-1.73-4.39-6-7.5-11-7.5-.83 0-1.64.09-2.42.27l1.57 1.57c.28-.08.56-.14.85-.14zm-7.44-1.8L3 5.61l2.45 2.45C3.81 9.4 2.63 11.3 2 12.5c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l2.42 2.42 1.41-1.41L4.56 4.2zM12 17.5c-3.04 0-5.5-2.46-5.5-5.5 0-.74.15-1.44.42-2.08l1.79 1.79c-.13.18-.21.43-.21.69 0 1.1.9 2 2 2 .26 0 .51-.08.69-.21l1.79 1.79c-.64.27-1.34.42-2.08.42zm1.61-4.8l-3.22-3.22C10.95 9.18 11.45 9 12 9c1.66 0 3 1.34 3 3 0 .55-.18 1.05-.48 1.61z';
      break;
    case 'play':
      path = 'M8 5v14l11-7z';
      break;
    case 'crown':
      path = 'M5 16h14a1 1 0 001-.76l2-9a1 1 0 00-1.56-1l-4.24 3.18L12.7 4.1a1 1 0 00-1.4 0L7.8 8.42 3.56 5.24a1 1 0 00-1.56 1l2 9a1 1 0 001 .76zM19 18H5a1 1 0 000 2h14a1 1 0 000-2z';
      break;
    case 'creation':
      path = 'M12 2l2.3 7.5L22 12l-7.7 2.5L12 22l-2.3-7.5L2 12l7.7-2.5L12 2zm7 2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2zm-13 13l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8z';
      break;
    default:
      path = '';
  }

  if (name === 'wallet' || name === 'wallet-outline') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path 
          d="M20 7h-3V5c0-1.1-.9-2-2-2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z" 
          stroke={color} 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <Path 
          d="M17 14h4v-4h-4c-1.1 0-2 .9-2 2s.9 2 2 2z" 
          fill={color} 
          stroke={color} 
          strokeWidth="2" 
        />
        <Circle cx="18.5" cy="12" r="1" fill="#FFFFFF" />
      </Svg>
    );
  }

  if (name === 'cash' || name === 'cash-outline' || name === 'banknote') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Rect x="2" y="6" width="20" height="12" rx="2" stroke={color} strokeWidth="2" />
        <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
        <Path d="M6 12h.01M18 12h.01" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'coins') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        {/* Back coin */}
        <Circle cx="8" cy="14" r="5" stroke={color} strokeWidth="2" fill="none" />
        <Circle cx="8" cy="14" r="2" stroke={color} strokeWidth="1" fill="none" />
        
        {/* Middle coin */}
        <Circle cx="12" cy="11" r="5" stroke={color} strokeWidth="2" fill="#FFFFFF" />
        <Circle cx="12" cy="11" r="2" stroke={color} strokeWidth="1" fill="none" />

        {/* Front coin */}
        <Circle cx="16" cy="8" r="5" stroke={color} strokeWidth="2" fill="#FFFFFF" />
        <Circle cx="16" cy="8" r="2" stroke={color} strokeWidth="1" fill="none" />
      </Svg>
    );
  }

  if (name === 'dice' || name === 'dice-outline') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke={color} strokeWidth="2" />
        <Circle cx="8" cy="8" r="1.5" fill={color} />
        <Circle cx="16" cy="8" r="1.5" fill={color} />
        <Circle cx="12" cy="12" r="1.5" fill={color} />
        <Circle cx="8" cy="16" r="1.5" fill={color} />
        <Circle cx="16" cy="16" r="1.5" fill={color} />
      </Svg>
    );
  }

  if (name === 'sync' || name === 'sync-outline') {
    return (
      <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
        <Path
          d="M434.67 285.59v-29.8C434.67 157.06 354.43 77 255.47 77a179 179 0 00-140.14 67.36m-38.53 82v29.8C76.8 355 157 435 256 435a180.45 180.45 0 00140-66.92"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="32"
        />
        <Path
          d="M32 256l44-44 46 44"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="32"
        />
        <Path
          d="M480 256l-44 44-46-44"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="32"
        />
      </Svg>
    );
  }

  if (name === 'wizard-hat' || name === 'hat-wizard') {
    return (
      <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
        {/* שולי הכובע */}
        <Rect x="64" y="384" width="384" height="32" rx="16" fill={color} />
        {/* גוף הכובע */}
        <Path
          d="M128 384 L144 128 C144 110 160 96 178 96 L334 96 C352 96 368 110 368 128 L384 384 Z"
          fill={color}
        />
        {/* סרט אדום לקישוט */}
        <Path
          d="M125 336 L128 384 L384 384 L387 336 Z"
          fill="#EF4444"
        />
        {/* כוכב זהב מרחף */}
        <Path
          d="M256 32 L262 48 L278 50 L266 62 L270 78 L256 70 L242 78 L246 62 L234 50 L250 48 Z"
          fill="#FBBF24"
        />
      </Svg>
    );
  }

  if (name === 'magic-wand' || name === 'magic') {
    return (
      <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
        {/* מקל הקסמים (אלכסוני) */}
        <Path
          d="M100 412 L412 100"
          stroke={color}
          strokeWidth="32"
          strokeLinecap="round"
          fill="none"
        />
        {/* ניצוץ זהוב ראשי */}
        <Path
          d="M420 40 L424 56 L440 58 L428 70 L432 86 L418 78 L404 86 L408 70 L396 58 L412 56 Z"
          fill="#FBBF24"
        />
        {/* ניצוץ זהוב משני */}
        <Path
          d="M340 60 L343 70 L353 71 L345 79 L347 89 L339 84 L331 89 L333 79 L325 71 L335 70 Z"
          fill="#FBBF24"
        />
      </Svg>
    );
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox={viewBox}
      style={style}
    >
      <Path d={path} fill={color} />
    </Svg>
  );
};

export default NavigationIcon;

export interface Notification {
  idNotification: string;
  ticketId: string | null;
  /** Número visible del ticket ("#43"); ticketId es para enlazar. */
  ticketNumber?: number | null;
  userId: string;
  typeNotification: string;
  subjectNotification: string;
  messageNotification: string;
  statusNotification: string;
  /** Si el usuario ya abrió la notificación. */
  readNotification: boolean;
  readAtNotification: string | null;
  sentAt: string | null;
  createdAtNotification: string;
}
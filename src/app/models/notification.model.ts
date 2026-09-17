export interface Notification {
  idNotification: number;
  ticketId: number | null;
  userId: number;
  typeNotification: string;
  subjectNotification: string;
  messageNotification: string;
  statusNotification: string;
  sentAt: string | null;
  createdAtNotification: string;
}
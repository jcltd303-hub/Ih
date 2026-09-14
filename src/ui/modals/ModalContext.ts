export type ModalContext = {
  modalContainer: HTMLElement;
  closeModal: () => void;
  openModal: (html: string) => void;
  addBalance: (gc: number, sc: number) => void;
  getScBalance: () => number;
};

export interface FullText {
  bookId: string
  source: string
  chapters: { title: string; paragraphs: string[] }[]
}

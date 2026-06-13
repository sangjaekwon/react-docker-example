"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

interface Post {
  id: number;
  message: string;
  author_ip: string;
  headers: unknown;
  created_at: string;
}

interface CheckResponse {
  timestamp: number;
  my_ip: string;
  headers: unknown;
}

interface ApiError {
  error: string;
}

interface PostsResponse {
  items: Post[];
  count: number;
}

type RequestState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

const POSTS_LIMIT = 50;

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiError).error === "string"
  );
}

async function readJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new Error(payload.error);
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  return payload as T;
}

function formatServerTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(timestamp * 1000));
}

function formatPostDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function prettyPrint(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

export default function Home() {
  const [checkState, setCheckState] = useState<RequestState<CheckResponse>>({
    data: null,
    error: null,
    isLoading: true,
  });
  const [postsState, setPostsState] = useState<RequestState<PostsResponse>>({
    data: null,
    error: null,
    isLoading: true,
  });
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openHeaderIds, setOpenHeaderIds] = useState<Set<number>>(new Set());

  const fetchCheck = useCallback(async () => {
    setCheckState((current) => ({ ...current, error: null, isLoading: true }));

    try {
      const data = await readJson<CheckResponse>(await fetch("/api/check"));
      setCheckState({ data, error: null, isLoading: false });
    } catch (error) {
      setCheckState({
        data: null,
        error: error instanceof Error ? error.message : "상태 확인에 실패했습니다.",
        isLoading: false,
      });
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setPostsState((current) => ({ ...current, error: null, isLoading: true }));

    try {
      const data = await readJson<PostsResponse>(
        await fetch(`/api/posts?limit=${POSTS_LIMIT}`),
      );
      setPostsState({ data, error: null, isLoading: false });
    } catch (error) {
      setPostsState({
        data: null,
        error: error instanceof Error ? error.message : "게시글 목록 조회에 실패했습니다.",
        isLoading: false,
      });
    }
  }, []);

  useEffect(() => {
    void fetchCheck();
    void fetchPosts();
  }, [fetchCheck, fetchPosts]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setSubmitError("message is required");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await readJson<Post>(
        await fetch("/api/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: trimmedMessage }),
        }),
      );

      setMessage("");
      await fetchPosts();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "게시글 등록에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleHeaders(postId: number) {
    setOpenHeaderIds((current) => {
      const next = new Set(current);

      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }

      return next;
    });
  }

  const posts = postsState.data?.items ?? [];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>API dashboard</p>
          <h1>게시글 API 클라이언트</h1>
          <p className={styles.description}>
            서버 상태를 확인하고, 작성자 IP와 요청 헤더가 포함된 게시글을
            생성 및 조회합니다.
          </p>
        </div>
        <button className={styles.ghostButton} onClick={fetchCheck} type="button">
          상태 다시 확인
        </button>
      </section>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="check-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>GET /api/check</p>
              <h2 id="check-title">상태 체크</h2>
            </div>
            {checkState.isLoading ? (
              <span className={styles.statusPill}>확인 중</span>
            ) : (
              <span className={styles.statusPill}>완료</span>
            )}
          </div>

          {checkState.error ? (
            <p className={styles.errorMessage}>{checkState.error}</p>
          ) : null}

          {checkState.data ? (
            <div className={styles.statList}>
              <div>
                <span>Server time</span>
                <strong>{formatServerTimestamp(checkState.data.timestamp)}</strong>
              </div>
              <div>
                <span>My IP</span>
                <strong>{checkState.data.my_ip}</strong>
              </div>
              <div className={styles.fullWidth}>
                <span>Headers</span>
                <pre>{prettyPrint(checkState.data.headers)}</pre>
              </div>
            </div>
          ) : checkState.isLoading ? (
            <p className={styles.muted}>서버 상태를 불러오는 중입니다.</p>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="compose-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>POST /api/posts</p>
              <h2 id="compose-title">게시글 작성</h2>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              onChange={(event) => setMessage(event.target.value)}
              placeholder="공유할 메시지를 입력하세요."
              rows={6}
              value={message}
            />
            {submitError ? (
              <p className={styles.errorMessage}>{submitError}</p>
            ) : null}
            <button
              className={styles.primaryButton}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </form>
        </section>
      </div>

      <section className={styles.card} aria-labelledby="posts-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>GET /api/posts?limit={POSTS_LIMIT}</p>
            <h2 id="posts-title">게시글 리스트</h2>
          </div>
          <button className={styles.ghostButton} onClick={fetchPosts} type="button">
            목록 새로고침
          </button>
        </div>

        {postsState.error ? (
          <p className={styles.errorMessage}>{postsState.error}</p>
        ) : null}

        {postsState.isLoading ? (
          <div className={styles.skeletonList} aria-label="게시글 목록 로딩 중">
            <div />
            <div />
            <div />
          </div>
        ) : posts.length > 0 ? (
          <div className={styles.postList}>
            {posts.map((post) => {
              const isOpen = openHeaderIds.has(post.id);

              return (
                <article className={styles.postCard} key={post.id}>
                  <div className={styles.postMeta}>
                    <time dateTime={post.created_at}>
                      {formatPostDate(post.created_at)}
                    </time>
                    <span>{post.author_ip}</span>
                  </div>
                  <p className={styles.postMessage}>{post.message}</p>
                  <button
                    className={styles.inlineButton}
                    onClick={() => toggleHeaders(post.id)}
                    type="button"
                  >
                    {isOpen ? "Headers 접기" : "Headers 펼치기"}
                  </button>
                  {isOpen ? <pre>{prettyPrint(post.headers)}</pre> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>아직 등록된 게시글이 없습니다.</p>
        )}
      </section>
    </main>
  );
}

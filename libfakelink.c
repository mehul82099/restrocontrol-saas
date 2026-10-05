#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <dlfcn.h>
#include <errno.h>
#include <string.h>

static int copy_file_fd(int in, int out) {
    char buf[8192];
    ssize_t bytes;
    while ((bytes = read(in, buf, sizeof(buf))) > 0) {
        if (write(out, buf, bytes) != bytes) {
            return -1;
        }
    }
    return (bytes < 0) ? -1 : 0;
}

int link(const char *oldpath, const char *newpath) {
    int in = open(oldpath, O_RDONLY);
    if (in < 0) {
        return -1;
    }
    struct stat st;
    if (fstat(in, &st) < 0) { close(in); return -1; }
    int out = open(newpath, O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (out < 0) { close(in); return -1; }
    int res = copy_file_fd(in, out);
    close(in);
    close(out);
    return res;
}

int linkat(int olddirfd, const char *oldpath, int newdirfd, const char *newpath, int flags) {
    int in = openat(olddirfd, oldpath, O_RDONLY);
    if (in < 0) {
        return -1;
    }
    struct stat st;
    if (fstat(in, &st) < 0) { close(in); return -1; }
    int out = openat(newdirfd, newpath, O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (out < 0) { close(in); return -1; }
    int res = copy_file_fd(in, out);
    close(in);
    close(out);
    return res;
}

static uid_t (*real_getuid)(void) = NULL;
static uid_t (*real_geteuid)(void) = NULL;

uid_t getuid(void) {
    char *p = getenv("FAKEROOT_POSTGRES");
    if (p && strcmp(p, "1") == 0) return 103;
    if (!real_getuid) real_getuid = (uid_t (*)(void))dlsym(RTLD_NEXT, "getuid");
    return real_getuid ? real_getuid() : 0;
}

uid_t geteuid(void) {
    char *p = getenv("FAKEROOT_POSTGRES");
    if (p && strcmp(p, "1") == 0) return 103;
    if (!real_geteuid) real_geteuid = (uid_t (*)(void))dlsym(RTLD_NEXT, "geteuid");
    return real_geteuid ? real_geteuid() : 0;
}

static int (*real_xstat)(int ver, const char *path, struct stat *buf) = NULL;
static int (*real_lxstat)(int ver, const char *path, struct stat *buf) = NULL;
static int (*real_fxstat)(int ver, int fildes, struct stat *buf) = NULL;

int __xstat(int ver, const char *path, struct stat *buf) {
    if (!real_xstat) real_xstat = dlsym(RTLD_NEXT, "__xstat");
    int ret = real_xstat(ver, path, buf);
    if (ret == 0 && getenv("FAKEROOT_POSTGRES") && buf->st_uid == 0) {
        buf->st_uid = 103;
        buf->st_gid = 103;
    }
    return ret;
}

int __lxstat(int ver, const char *path, struct stat *buf) {
    if (!real_lxstat) real_lxstat = dlsym(RTLD_NEXT, "__lxstat");
    int ret = real_lxstat(ver, path, buf);
    if (ret == 0 && getenv("FAKEROOT_POSTGRES") && buf->st_uid == 0) {
        buf->st_uid = 103;
        buf->st_gid = 103;
    }
    return ret;
}

int __fxstat(int ver, int fildes, struct stat *buf) {
    if (!real_fxstat) real_fxstat = dlsym(RTLD_NEXT, "__fxstat");
    int ret = real_fxstat(ver, fildes, buf);
    if (ret == 0 && getenv("FAKEROOT_POSTGRES") && buf->st_uid == 0) {
        buf->st_uid = 103;
        buf->st_gid = 103;
    }
    return ret;
}

/* SysV shm emulation */
#define SHM_DIR "/tmp/.sysv_shm"

static void ensure_shm_dir(void) {
    mkdir(SHM_DIR, 0777);
    chmod(SHM_DIR, 0777);
}

struct attach_record {
    void *addr;
    size_t size;
    int shmid;
};
static struct attach_record attaches[512];
static int num_attaches = 0;

int shmget(key_t key, size_t size, int shmflg) {
    ensure_shm_dir();
    int shmid = 0;
    char path[256];
    char keypath[256];

    if (key != IPC_PRIVATE) {
        snprintf(keypath, sizeof(keypath), "%s/key_%d", SHM_DIR, (int)key);
        int kfd = open(keypath, O_RDONLY);
        if (kfd >= 0) {
            char buf[32];
            ssize_t n = read(kfd, buf, sizeof(buf) - 1);
            close(kfd);
            if (n > 0) {
                buf[n] = '\0';
                shmid = atoi(buf);
                snprintf(path, sizeof(path), "%s/data_%d", SHM_DIR, shmid);
                if (access(path, F_OK) != 0) {
                    unlink(keypath);
                    shmid = 0;
                }
            }
        }
    }

    if (shmid > 0) {
        if ((shmflg & IPC_CREAT) && (shmflg & IPC_EXCL)) {
            errno = EEXIST;
            return -1;
        }
        return shmid;
    }

    if (!(shmflg & IPC_CREAT)) {
        errno = ENOENT;
        return -1;
    }

    shmid = (key > 0) ? (int)key : (rand() % 900000 + 100000);
    snprintf(path, sizeof(path), "%s/data_%d", SHM_DIR, shmid);
    int fd = open(path, O_RDWR | O_CREAT | O_TRUNC, 0666);
    if (fd < 0) {
        return -1;
    }
    if (ftruncate(fd, size) < 0) {
        close(fd);
        return -1;
    }
    close(fd);

    if (key != IPC_PRIVATE) {
        snprintf(keypath, sizeof(keypath), "%s/key_%d", SHM_DIR, (int)key);
        int kfd = open(keypath, O_WRONLY | O_CREAT | O_TRUNC, 0666);
        if (kfd >= 0) {
            char buf[32];
            int len = snprintf(buf, sizeof(buf), "%d", shmid);
            if (len > 0) write(kfd, buf, len);
            close(kfd);
        }
    }

    return shmid;
}

void *shmat(int shmid, const void *shmaddr, int shmflg) {
    char path[256];
    snprintf(path, sizeof(path), "%s/data_%d", SHM_DIR, shmid);
    int fd = open(path, O_RDWR);
    if (fd < 0) {
        errno = EINVAL;
        return (void *)-1;
    }
    struct stat st;
    if (fstat(fd, &st) < 0) {
        close(fd);
        errno = EINVAL;
        return (void *)-1;
    }
    size_t size = st.st_size;
    void *addr = mmap((void *)shmaddr, size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    close(fd);
    if (addr == MAP_FAILED) {
        return (void *)-1;
    }
    if (num_attaches < 512) {
        attaches[num_attaches].addr = addr;
        attaches[num_attaches].size = size;
        attaches[num_attaches].shmid = shmid;
        num_attaches++;
    }
    return addr;
}

int shmdt(const void *shmaddr) {
    for (int i = 0; i < num_attaches; i++) {
        if (attaches[i].addr == shmaddr) {
            munmap((void *)shmaddr, attaches[i].size);
            attaches[i] = attaches[num_attaches - 1];
            num_attaches--;
            return 0;
        }
    }
    return 0;
}

int shmctl(int shmid, int cmd, struct shmid_ds *buf) {
    char path[256];
    snprintf(path, sizeof(path), "%s/data_%d", SHM_DIR, shmid);

    if (cmd == IPC_RMID) {
        unlink(path);
        char keypath[256];
        snprintf(keypath, sizeof(keypath), "%s/key_%d", SHM_DIR, shmid);
        unlink(keypath);
        return 0;
    }
    if (cmd == IPC_STAT) {
        struct stat st;
        if (stat(path, &st) < 0) {
            errno = EINVAL;
            return -1;
        }
        if (buf) {
            memset(buf, 0, sizeof(*buf));
            buf->shm_segsz = st.st_size;
            buf->shm_nattch = 0;
            buf->shm_perm.mode = 0666;
            buf->shm_perm.uid = geteuid();
            buf->shm_perm.gid = 103;
        }
        return 0;
    }
    return 0;
}

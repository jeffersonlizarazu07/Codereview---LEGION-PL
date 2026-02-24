import httpx
import os

# Leemos las variables de entorno (equivalente a process.env.X en Node)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "juanhenaoparra/minidyn")
BASE_URL = "https://api.github.com"

# Headers que van en cada request a GitHub
HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",  # f"..." = template literals de JS
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

async def get_branch_diff(branch: str, base: str = "main") -> dict:
    """
    Compara una rama contra main y retorna los archivos cambiados con sus diffs.
    """
    url = f"{BASE_URL}/repos/{GITHUB_REPO}/compare/{base}...{branch}"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url, headers=HEADERS)
        except httpx.TimeoutException:
            return {"error": "Timeout conectando con GitHub. Intenta de nuevo."}
        except httpx.RequestError as e:
            return {"error": f"Error de conexión con GitHub: {str(e)}"}

        # Rate limit alcanzado
        if resp.status_code == 403:
            reset_time = resp.headers.get("X-RateLimit-Reset", "desconocido")
            return {"error": f"Rate limit de GitHub alcanzado. Reset en: {reset_time}"}

        # Rama o repo no encontrado
        if resp.status_code == 404:
            return {"error": f"Branch '{branch}' no encontrada o el repositorio no existe."}

        # Cualquier otro error HTTP
        if resp.status_code != 200:
            return {"error": f"GitHub API error {resp.status_code}: {resp.text[:200]}"}

        data = resp.json()

        # Repo vacío o sin commits
        if data.get("status") == "identical":
            return {"error": f"La rama '{branch}' es idéntica a main. No hay cambios."}

        if not data.get("files"):
            return {"error": f"No se encontraron archivos modificados entre '{branch}' y main."}

        files = []
        for f in data.get("files", []):
            # Ignorar archivos eliminados
            if f.get("status") == "removed":
                continue

            # Detectar archivos binarios (no tienen patch)
            if "patch" not in f:
                files.append({
                    "filename": f["filename"],
                    "status": f["status"],
                    "additions": f.get("additions", 0),
                    "deletions": f.get("deletions", 0),
                    "patch": "[archivo binario — no se puede mostrar diff]",
                })
                continue

            files.append({
                "filename": f["filename"],
                "status": f["status"],
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "patch": f.get("patch", ""),
            })

        return {
            "branch": branch,
            "base": base,
            "total_commits": data.get("total_commits", 0),
            "files": files,
        }
    
async def get_file_content(filepath: str, branch: str) -> str:
    """
    Obtiene el contenido completo de un archivo en una rama específica.
    """
    url = f"{BASE_URL}/repos/{GITHUB_REPO}/contents/{filepath}?ref={branch}"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url, headers=HEADERS)
        except httpx.TimeoutException:
            return f"[Timeout obteniendo {filepath}]"
        except httpx.RequestError as e:
            return f"[Error de conexión: {str(e)}]"

        if resp.status_code == 403:
            return f"[Rate limit alcanzado obteniendo {filepath}]"

        if resp.status_code == 404:
            return f"[Archivo no encontrado: {filepath}]"

        if resp.status_code != 200:
            return f"[GitHub API error {resp.status_code}]"

        data = resp.json()

        # Archivo demasiado grande (GitHub no retorna contenido > 1MB)
        if data.get("size", 0) > 1_000_000:
            return f"[Archivo demasiado grande para analizar: {data.get('size', 0)} bytes]"

        if data.get("encoding") == "base64":
            import base64
            try:
                content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
                return content
            except Exception as e:
                return f"[Error decodificando archivo: {str(e)}]"

        return "[No se pudo decodificar el archivo]"


async def get_repo_tree(branch: str) -> list[str]:
    """
    Retorna la lista de todos los archivos del repo en una rama.
    """
    url = f"{BASE_URL}/repos/{GITHUB_REPO}/git/trees/{branch}?recursive=1"
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=HEADERS)
        
        if resp.status_code != 200:
            return []

        data = resp.json()
        
        # Filtramos solo archivos (no carpetas)
        return [
            item["path"]
            for item in data.get("tree", [])
            if item["type"] == "blob"  # "blob" = archivo, "tree" = carpeta
        ]
    
    [item["path"] for item in data["tree"] if item["type"] == "blob"]